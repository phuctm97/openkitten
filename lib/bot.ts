import type { AssistantMessage, Event } from "@opencode-ai/sdk/v2";
import {
  Cause,
  Config,
  Context,
  Deferred,
  Effect,
  Exit,
  Fiber,
  HashMap,
  HashSet,
  Layer,
  Option,
  Redacted,
  Ref,
  Runtime,
} from "effect";
import { Bot as GrammyBot } from "grammy";
import { Database } from "~/lib/database";
import { formatBusy } from "~/lib/format-busy";
import { formatError } from "~/lib/format-error";
import { formatMessage, type MessageChunk } from "~/lib/format-message";
import { formatReset } from "~/lib/format-reset";
import { formatStart } from "~/lib/format-start";
import { formatStop } from "~/lib/format-stop";
import { isTextPart } from "~/lib/is-text-part";
import { OpenCode } from "~/lib/opencode";
import pkg from "~/package.json" with { type: "json" };

export class Bot extends Context.Tag(`${pkg.name}/Bot`)<
  Bot,
  { readonly fiber: Fiber.RuntimeFiber<void>; readonly client: GrammyBot }
>() {
  /** Manages the grammY bot lifecycle and SSE event stream. */
  static readonly layer = Layer.scoped(
    Bot,
    Effect.gen(function* () {
      yield* Effect.logDebug("Bot.service is starting");
      const botScope = yield* Effect.scope;
      const redactedToken = yield* Config.redacted("TELEGRAM_BOT_TOKEN");
      const userId = yield* Config.integer("TELEGRAM_USER_ID");
      const runtime = yield* Effect.runtime<Database>();
      const opencode = yield* OpenCode;
      const database = yield* Database;

      // grammY bot — created early so processEvent can reference client.api.
      // Handlers and lifecycle are registered further below.
      const client = new GrammyBot(Redacted.value(redactedToken));

      // Tracks sessions with in-flight promptAsync calls to prevent the
      // TOCTOU race between checking session.status() and calling promptAsync.
      const promptingRef = yield* Ref.make(HashSet.empty<string>());
      const typingFibers = yield* Ref.make(
        HashMap.empty<string, Fiber.RuntimeFiber<never>>(),
      );

      /** Starts sending "typing" chat actions every 4 s. Idempotent per session. */
      const startTyping = (
        sessionId: string,
        chatId: number,
        threadId: number | undefined,
      ) =>
        Effect.gen(function* () {
          if (HashMap.has(yield* Ref.get(typingFibers), sessionId)) return;
          yield* Effect.logDebug("Bot.service started the typing indicator");
          const fiber = yield* Effect.forever(
            Effect.gen(function* () {
              yield* Effect.promise(() =>
                client.api.sendChatAction(chatId, "typing", {
                  ...(threadId && { message_thread_id: threadId }),
                }),
              ).pipe(
                Effect.annotateLogs("debugHint", "Bot.sendTyping"),
                Effect.ignoreLogged,
              );
              yield* Effect.sleep(4_000);
            }),
          ).pipe(Effect.forkIn(botScope));
          yield* Ref.update(typingFibers, HashMap.set(sessionId, fiber));
        }).pipe(
          Effect.annotateLogs("sessionId", sessionId),
          Effect.annotateLogs("chatId", chatId),
          Effect.annotateLogs("threadId", threadId),
        );

      /** Stops the typing indicator for a session. No-op if not found. */
      const stopTyping = (sessionId: string) =>
        Effect.gen(function* () {
          const fiber = HashMap.get(
            yield* Ref.getAndUpdate(typingFibers, HashMap.remove(sessionId)),
            sessionId,
          );
          if (Option.isNone(fiber)) return;
          yield* Fiber.interrupt(fiber.value);
          yield* Effect.logDebug("Bot.service stopped the typing indicator");
        }).pipe(Effect.annotateLogs("sessionId", sessionId));

      // --- Event processing ---

      /** Claims and delivers a completed assistant message to Telegram. */
      const processCompletedAssistantMessage = (
        session: Database.Session,
        message: AssistantMessage,
      ) =>
        Effect.gen(function* () {
          const claimed = yield* database.message.claim({
            id: message.id,
            sessionId: message.sessionID,
            createdAt: message.time.created,
          });
          if (!claimed) return;
          const sendOpts = {
            client,
            chatId: session.chatId,
            threadId: session.threadId || undefined,
          };
          yield* Effect.gen(function* () {
            const msgResult = yield* Effect.promise(() =>
              opencode.client.session.message({
                sessionID: message.sessionID,
                messageID: message.id,
              }),
            );
            if (msgResult.error) {
              yield* Effect.logError(msgResult.error).pipe(
                Effect.annotateLogs("debugHint", "Bot.fetchMessage"),
              );
              yield* Bot.sendChunks({
                ...sendOpts,
                chunks: yield* formatError(msgResult.error),
                ignoreErrors: false,
              });
              return;
            }
            const replyText = msgResult.data.parts
              .filter(isTextPart)
              .map((p) => p.text)
              .filter(Boolean)
              .join("\n")
              .trim();
            if (replyText) {
              yield* Bot.sendChunks({
                ...sendOpts,
                chunks: yield* formatMessage(replyText),
                ignoreErrors: false,
              });
              yield* Effect.logDebug("Bot.service delivered the reply");
            } else {
              yield* Effect.logDebug("Bot.service skipped a non-text message");
            }
          }).pipe(
            Effect.catchAllDefect((defect) =>
              Effect.gen(function* () {
                yield* Effect.logError(defect).pipe(
                  Effect.annotateLogs("debugHint", "Bot.deliverMessage"),
                );
                yield* Bot.sendChunks({
                  ...sendOpts,
                  chunks: yield* formatError(defect),
                  ignoreErrors: true,
                });
              }),
            ),
          );
        }).pipe(
          Effect.annotateLogs("sessionId", message.sessionID),
          Effect.annotateLogs("chatId", session.chatId),
          Effect.annotateLogs("threadId", session.threadId || undefined),
        );

      /** Handles a single SSE event: sends the reply or error to Telegram. */
      const processEvent = (event: Event) =>
        Effect.gen(function* () {
          if (event.type === "message.updated") {
            const { info } = event.properties;
            if (
              info.role === "assistant" &&
              info.time.completed !== undefined
            ) {
              const session = yield* database.session.findById(info.sessionID);
              if (Option.isNone(session)) {
                yield* Effect.logDebug(
                  "Bot.service ignored a message from an unknown session",
                ).pipe(Effect.annotateLogs("sessionId", info.sessionID));
              } else {
                yield* processCompletedAssistantMessage(session.value, info);
              }
            }
          } else if (event.type === "session.status") {
            const { sessionID, status } = event.properties;
            if (status.type === "busy" || status.type === "retry") {
              const session = yield* database.session.findById(sessionID);
              if (Option.isSome(session)) {
                yield* startTyping(
                  sessionID,
                  session.value.chatId,
                  session.value.threadId || undefined,
                );
              }
            } else {
              yield* stopTyping(sessionID);
            }
          } else if (event.type === "session.error") {
            const { sessionID, error } = event.properties;
            if (!sessionID) {
              yield* Effect.logWarning(
                "Bot.service ignored a session.error without a sessionID",
              );
              return;
            }
            const session = yield* database.session.findById(sessionID);
            if (Option.isNone(session)) {
              yield* Effect.logDebug(
                "Bot.service ignored a session.error from an unknown session",
              ).pipe(Effect.annotateLogs("sessionId", sessionID));
              return;
            }
            const sendOpts = {
              client,
              chatId: session.value.chatId,
              threadId: session.value.threadId || undefined,
            };
            yield* Effect.gen(function* () {
              if (error?.name === "MessageAbortedError") {
                yield* Effect.logDebug(error).pipe(
                  Effect.annotateLogs("debugHint", "Bot.opencodeSessionAbort"),
                );
                yield* Bot.sendChunks({
                  ...sendOpts,
                  chunks: yield* formatStop(),
                  ignoreErrors: false,
                });
              } else {
                yield* Effect.logWarning(error).pipe(
                  Effect.annotateLogs("debugHint", "Bot.opencodeSessionError"),
                );
                yield* Bot.sendChunks({
                  ...sendOpts,
                  chunks: yield* formatError(error),
                  ignoreErrors: false,
                });
              }
            }).pipe(
              Effect.catchAllDefect((defect) =>
                Effect.gen(function* () {
                  yield* Effect.logError(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.deliverError"),
                  );
                  yield* Bot.sendChunks({
                    ...sendOpts,
                    chunks: yield* formatError(defect),
                    ignoreErrors: true,
                  });
                }),
              ),
              Effect.annotateLogs("sessionId", sessionID),
              Effect.annotateLogs("chatId", session.value.chatId),
              Effect.annotateLogs("threadId", sendOpts.threadId),
            );
          }
        }).pipe(
          Effect.catchAllDefect((defect) =>
            Effect.logError(defect).pipe(
              Effect.annotateLogs("debugHint", "Bot.processEvent"),
            ),
          ),
        );

      // --- SSE stream with reconnect ---

      // Each iteration subscribes to the SSE stream, consumes events, and
      // cleans up the iterator via acquireRelease. On disconnect or error,
      // catchAllDefect logs and waits before the next iteration reconnects.
      const reconnectAttempt = yield* Ref.make(0);
      const consumeEventStream = Effect.scoped(
        Effect.gen(function* () {
          yield* Effect.logDebug("Bot.stream is connecting");
          const iter = yield* Effect.acquireRelease(
            Effect.promise(() => opencode.client.event.subscribe({})).pipe(
              Effect.map(({ stream }) => stream[Symbol.asyncIterator]()),
            ),
            (iter) =>
              Effect.sync(() => {
                iter.return?.(undefined);
              }),
          );
          // Reconcile messages that completed while disconnected. Fetches
          // the newest messages per session, expanding the window until an
          // already-claimed message is found, then processes unclaimed ones
          // in order. Sessions run in parallel.
          const sessions = yield* database.session.findAll();
          yield* Effect.forEach(
            sessions,
            (session) =>
              Effect.gen(function* () {
                let limit = 10;
                let messages: Array<AssistantMessage> = [];
                let foundOverlap = false;
                while (!foundOverlap) {
                  const result = yield* Effect.promise(() =>
                    opencode.client.session.messages({
                      sessionID: session.id,
                      limit,
                    }),
                  );
                  if (result.error) return yield* Effect.die(result.error);
                  messages = [];
                  for (const msg of result.data) {
                    if (
                      msg.info.role === "assistant" &&
                      msg.info.time.completed !== undefined
                    )
                      messages.push(msg.info);
                  }
                  const oldest = messages[0];
                  if (oldest === undefined) break;
                  // Check if the oldest message in this batch is already claimed
                  const existing = yield* database.message.findById(oldest.id);
                  if (Option.isSome(existing)) {
                    foundOverlap = true;
                  } else if (result.data.length < limit) {
                    // Reached the beginning of history
                    break;
                  } else {
                    limit *= 2;
                  }
                }
                for (const msg of messages) {
                  yield* processCompletedAssistantMessage(session, msg);
                }
              }).pipe(
                Effect.catchAllDefect((defect) =>
                  Effect.logWarning(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.reconcileMessages"),
                  ),
                ),
                Effect.annotateLogs("sessionId", session.id),
              ),
            { concurrency: "unbounded", discard: true },
          );
          yield* Ref.set(reconnectAttempt, 0);
          yield* Effect.logDebug("Bot.stream is connected");
          // Uses Effect.async (interruptible) instead of Stream.fromAsyncIterable
          // (which uses Effect.tryPromise internally and deadlocks on scope close).
          // The cleanup callback calls iter.return() to unblock a pending next().
          return yield* Effect.forever(
            Effect.async<Event>((resume) => {
              iter.next().then(
                (r) =>
                  r.done
                    ? resume(Effect.die("Bot.stream ended"))
                    : resume(Effect.succeed(r.value)),
                (e) => resume(Effect.die(e)),
              );
              return Effect.sync(() => {
                iter.return?.(undefined);
              });
            }).pipe(
              Effect.tap((event) =>
                Effect.forkIn(processEvent(event), botScope),
              ),
            ),
          );
        }),
      );
      const maxReconnectAttempts = 10;
      yield* Effect.forever(
        consumeEventStream.pipe(
          Effect.catchAllDefect((defect) =>
            Effect.gen(function* () {
              const attempt = yield* Ref.getAndUpdate(
                reconnectAttempt,
                (n) => n + 1,
              );
              if (attempt >= maxReconnectAttempts) {
                return yield* Effect.die(defect);
              }
              const delay = Math.min(1000 * 2 ** attempt, 30_000);
              yield* Effect.logWarning(
                "Bot.stream disconnected; reconnecting",
              ).pipe(Effect.annotateLogs("delay", `${delay}ms`));
              yield* Effect.sleep(delay);
            }),
          ),
        ),
      ).pipe(Effect.forkScoped);

      // --- grammY handlers ---

      client.catch(({ error, ctx }) =>
        Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            const cause = Runtime.isFiberFailure(error)
              ? Cause.squash(error[Runtime.FiberFailureCauseId])
              : error;
            yield* Effect.logError(cause).pipe(
              Effect.annotateLogs("debugHint", "Bot.grammyHandlerError"),
            );
            if (ctx.chat) {
              yield* Bot.sendChunks({
                client,
                chunks: yield* formatError(cause),
                ignoreErrors: true,
                chatId: ctx.chat.id,
                threadId: ctx.message?.message_thread_id,
              });
            }
          }).pipe(
            Effect.annotateLogs("userId", ctx.from?.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
            Effect.annotateLogs("chatId", ctx.chat?.id),
            Effect.annotateLogs("threadId", ctx.message?.message_thread_id),
          ),
        ),
      );

      const registerCommand = (
        name: string,
        handler: (opts: {
          chatId: number;
          threadId: number | undefined;
        }) => Effect.Effect<void>,
      ) =>
        client.command(name, (ctx) =>
          Runtime.runPromise(runtime)(
            Effect.gen(function* () {
              if (ctx.from?.id !== userId) {
                return yield* Effect.logWarning(
                  "Bot.service ignored a command from an unauthorized user",
                );
              }
              yield* Effect.logDebug(`Bot.service received /${name} command`);
              yield* handler({
                chatId: ctx.chat.id,
                threadId: ctx.message?.message_thread_id,
              });
            }).pipe(
              Effect.annotateLogs("userId", ctx.from?.id),
              Effect.annotateLogs("messageId", ctx.message?.message_id),
              Effect.annotateLogs("chatId", ctx.chat.id),
              Effect.annotateLogs("threadId", ctx.message?.message_thread_id),
            ),
          ),
        );

      registerCommand("start", ({ chatId, threadId }) =>
        Effect.gen(function* () {
          const { sessionId, isNew } = yield* Bot.findOrCreateSession({
            database,
            opencode,
            chatId,
            threadId,
          });
          yield* Bot.sendChunks({
            client,
            chunks: yield* formatStart(sessionId, isNew),
            ignoreErrors: false,
            chatId,
            threadId,
          });
        }),
      );

      registerCommand("stop", ({ chatId, threadId }) =>
        Effect.gen(function* () {
          const { sessionId } = yield* Bot.findOrCreateSession({
            database,
            opencode,
            chatId,
            threadId,
          });
          // Check remote status
          const statusResult = yield* Effect.promise(() =>
            opencode.client.session.status({}),
          );
          if (statusResult.error) return yield* Effect.die(statusResult.error);
          const sessionStatus = statusResult.data[sessionId];
          const remoteBusy =
            sessionStatus !== undefined && sessionStatus.type !== "idle";
          // Check local prompting guard
          const localBusy = HashSet.has(
            yield* Ref.get(promptingRef),
            sessionId,
          );
          if (!remoteBusy && !localBusy) {
            yield* Bot.sendChunks({
              client,
              chunks: yield* formatStop(),
              ignoreErrors: false,
              chatId,
              threadId,
            });
            return;
          }
          const result = yield* Effect.promise(() =>
            opencode.client.session.abort({ sessionID: sessionId }),
          );
          if (result.error) return yield* Effect.die(result.error);
          // Stop message is sent when session.error with MessageAbortedError arrives
        }),
      );

      registerCommand("reset", ({ chatId, threadId }) =>
        Effect.gen(function* () {
          const existing = yield* database.session.findByChat({
            chatId,
            threadId: threadId || 0,
          });
          if (Option.isSome(existing)) {
            const sessionId = existing.value.id;
            // Abort if busy
            const statusResult = yield* Effect.promise(() =>
              opencode.client.session.status({}),
            );
            if (statusResult.error)
              return yield* Effect.die(statusResult.error);
            const sessionStatus = statusResult.data[sessionId];
            const remoteBusy =
              sessionStatus !== undefined && sessionStatus.type !== "idle";
            const localBusy = HashSet.has(
              yield* Ref.get(promptingRef),
              sessionId,
            );
            if (remoteBusy || localBusy) {
              const abortResult = yield* Effect.promise(() =>
                opencode.client.session.abort({ sessionID: sessionId }),
              );
              if (abortResult.error)
                return yield* Effect.die(abortResult.error);
            }
            // Clean up in-memory state
            yield* stopTyping(sessionId);
            yield* Ref.update(promptingRef, HashSet.remove(sessionId));
            yield* database.session.delete(sessionId);
            yield* Effect.logInfo("Bot.service reset the session").pipe(
              Effect.annotateLogs("sessionId", sessionId),
            );
          }
          yield* Bot.sendChunks({
            client,
            chunks: yield* formatReset(),
            ignoreErrors: false,
            chatId,
            threadId,
          });
        }),
      );

      client.on("message:text", (ctx) =>
        Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            if (ctx.from?.id !== userId) {
              return yield* Effect.logWarning(
                "Bot.service ignored a message from an unauthorized user",
              );
            }
            yield* Effect.logDebug("Bot.service received a message");
            const { sessionId } = yield* Bot.findOrCreateSession({
              database,
              opencode,
              chatId: ctx.chat.id,
              threadId: ctx.message?.message_thread_id,
            });
            yield* Effect.gen(function* () {
              const rejectBusy = Effect.gen(function* () {
                yield* Effect.logDebug(
                  "Bot.service rejected a message while the session is busy",
                );
                yield* Bot.sendChunks({
                  client,
                  chunks: yield* formatBusy(),
                  ignoreErrors: false,
                  chatId: ctx.chat.id,
                  threadId: ctx.message?.message_thread_id,
                });
              });

              const statusResult = yield* Effect.promise(() =>
                opencode.client.session.status({}),
              );
              if (statusResult.error)
                return yield* Effect.die(statusResult.error);
              const sessionStatus = statusResult.data[sessionId];
              if (sessionStatus !== undefined && sessionStatus.type !== "idle")
                return yield* rejectBusy;
              // Atomically check-and-set the local prompting guard to close the
              // TOCTOU window between the status check and the promptAsync call.
              const localBusy = yield* Ref.modify(promptingRef, (set) =>
                HashSet.has(set, sessionId)
                  ? [true, set]
                  : [false, HashSet.add(set, sessionId)],
              );
              if (localBusy) return yield* rejectBusy;

              yield* Effect.gen(function* () {
                yield* Effect.logTrace("Bot.service is prompting OpenCode");
                const result = yield* Effect.promise(() =>
                  opencode.client.session.promptAsync({
                    sessionID: sessionId,
                    parts: [{ type: "text", text: ctx.message.text }],
                  }),
                );
                if (result.error) {
                  return yield* Effect.die(result.error);
                }
                yield* Effect.logTrace("Bot.service prompted OpenCode");
              }).pipe(
                Effect.ensuring(
                  Ref.update(promptingRef, HashSet.remove(sessionId)),
                ),
              );
            }).pipe(Effect.annotateLogs("sessionId", sessionId));
          }).pipe(
            Effect.annotateLogs("userId", ctx.from?.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
            Effect.annotateLogs("chatId", ctx.chat.id),
            Effect.annotateLogs("threadId", ctx.message?.message_thread_id),
          ),
        ),
      );

      // --- Lifecycle ---

      const ready = yield* Deferred.make<void>();
      const fiber = yield* Effect.acquireRelease(
        Effect.async<void>((resume) => {
          client
            .start({ onStart: () => Deferred.unsafeDone(ready, Exit.void) })
            .then(
              () => {
                Deferred.unsafeDone(ready, Exit.void);
                resume(Effect.void);
              },
              (error) => {
                Deferred.unsafeDone(ready, Exit.die(error));
                resume(Effect.die(error));
              },
            );
        }).pipe(Effect.forkScoped),
        () =>
          Effect.gen(function* () {
            yield* Effect.logDebug("Bot.service is stopping");
            yield* Effect.promise(() => client.stop()).pipe(
              Effect.ignoreLogged,
            );
            yield* Effect.logInfo("Bot.service has stopped");
          }),
      );
      yield* Deferred.await(ready);
      yield* Effect.logInfo("Bot.service is ready");
      return Bot.of({ fiber, client });
    }),
  );

  /**
   * Finds an existing session by chat and thread IDs, or creates one. If a
   * concurrent insert races and wins, catches the unique-constraint defect
   * and retries the lookup.
   */
  static findOrCreateSession({
    database,
    opencode,
    chatId,
    threadId,
  }: Bot.FindOrCreateSessionOptions) {
    return Effect.gen(function* () {
      const existing = yield* database.session.findByChat({
        chatId,
        threadId: threadId || 0,
      });
      if (Option.isSome(existing)) {
        yield* Effect.logTrace("Bot.service reused an existing session").pipe(
          Effect.annotateLogs("sessionId", existing.value.id),
        );
        return { sessionId: existing.value.id, isNew: false } as const;
      }
      const result = yield* Effect.promise(() =>
        opencode.client.session.create({}),
      );
      if (result.error) return yield* Effect.die(result.error);
      const sessionId = result.data.id;
      return yield* database.session
        .insert({
          id: sessionId,
          chatId,
          threadId: threadId || 0,
          createdAt: undefined,
          updatedAt: undefined,
        })
        .pipe(
          Effect.tap(
            Effect.logInfo("Bot.service created a new session").pipe(
              Effect.annotateLogs("sessionId", sessionId),
            ),
          ),
          Effect.as({ sessionId, isNew: true } as const),
          Effect.catchAllDefect((defect) =>
            Effect.gen(function* () {
              // Clean up the orphaned OpenCode session from the losing race
              // before looking up the winner, so it never lingers on failure.
              const deleteResult = yield* Effect.promise(() =>
                opencode.client.session.delete({ sessionID: sessionId }),
              );
              if (deleteResult.error)
                return yield* Effect.die(deleteResult.error);
              const raced = yield* database.session.findByChat({
                chatId,
                threadId: threadId || 0,
              });
              if (Option.isNone(raced)) return yield* Effect.die(defect);
              yield* Effect.logDebug(
                "Bot.service resolved a concurrent session race",
              ).pipe(Effect.annotateLogs("sessionId", raced.value.id));
              return { sessionId: raced.value.id, isNew: false } as const;
            }),
          ),
        );
    });
  }

  /** Sends chunks to Telegram, falling back to plain text if MarkdownV2 fails. */
  static sendChunks({
    client,
    chunks,
    ignoreErrors,
    chatId,
    threadId,
  }: Bot.SendChunksOptions) {
    const sendOpts = {
      ...(threadId && { message_thread_id: threadId }),
    };
    return Effect.forEach(
      chunks,
      ({ markdown, text }) => {
        const sendEffect = markdown
          ? Effect.promise(() =>
              client.api.sendMessage(chatId, markdown, {
                parse_mode: "MarkdownV2",
                ...sendOpts,
              }),
            ).pipe(
              Effect.catchAllDefect((defect) =>
                Effect.gen(function* () {
                  yield* Effect.logDebug(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.sendChunks"),
                  );
                  yield* Effect.logDebug(
                    "Bot.service failed to send a MarkdownV2 message, falling back to plain text",
                  ).pipe(
                    Effect.annotateLogs("markdown", markdown),
                    Effect.annotateLogs("text", text),
                  );
                  yield* Effect.promise(() =>
                    client.api.sendMessage(chatId, text, sendOpts),
                  );
                }),
              ),
            )
          : Effect.promise(() =>
              client.api.sendMessage(chatId, text, sendOpts),
            );
        return ignoreErrors ? Effect.ignoreLogged(sendEffect) : sendEffect;
      },
      { discard: true },
    );
  }
}

export namespace Bot {
  export interface FindOrCreateSessionOptions {
    readonly database: Context.Tag.Service<typeof Database>;
    readonly opencode: Context.Tag.Service<typeof OpenCode>;
    readonly chatId: number;
    readonly threadId: number | undefined;
  }

  export interface SendChunksOptions {
    readonly client: GrammyBot;
    readonly chunks: MessageChunk[];
    readonly ignoreErrors: boolean;
    readonly chatId: number;
    readonly threadId: number | undefined;
  }
}
