import type { Event } from "@opencode-ai/sdk/v2";
import {
  Cause,
  Config,
  Context,
  Deferred,
  Effect,
  Exit,
  type Fiber,
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
import { formatMessage } from "~/lib/format-message";
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

      /** Handles a single SSE event: sends the reply or error to Telegram. */
      const processEvent = (event: Event) =>
        Effect.gen(function* () {
          if (event.type === "message.updated") {
            const { info } = event.properties;
            // Only act on fully completed assistant messages
            if (info.role !== "assistant" || info.time.completed === undefined)
              return;
            const session = yield* database.session.findById(info.sessionID);
            if (Option.isNone(session)) {
              yield* Effect.logDebug(
                "Bot.service ignored a message.updated for an unknown session",
              ).pipe(Effect.annotateLogs("sessionId", info.sessionID));
              return;
            }
            const sendOpts = {
              client,
              chatId: session.value.chatId,
              threadId: session.value.threadId || undefined,
              dmTopicId: session.value.dmTopicId || undefined,
            };
            yield* Effect.gen(function* () {
              // Fetch the full message to get all parts (text, tool, etc.)
              const msgResult = yield* Effect.promise(() =>
                opencode.client.session.message({
                  sessionID: info.sessionID,
                  messageID: info.id,
                }),
              );
              if (msgResult.error) {
                yield* Effect.logError(msgResult.error).pipe(
                  Effect.annotateLogs("debugHint", "Bot.service"),
                );
                yield* Bot.sendChunks({
                  ...sendOpts,
                  chunks: formatError(msgResult.error),
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
                  chunks: formatMessage(replyText),
                  ignoreErrors: false,
                });
                yield* Effect.logTrace("Bot.service sent a reply");
              } else {
                yield* Effect.logDebug(
                  "Bot.service received a non-text message",
                );
              }
            }).pipe(
              Effect.catchAllDefect((defect) =>
                Effect.gen(function* () {
                  yield* Effect.logError(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.service"),
                  );
                  yield* Bot.sendChunks({
                    ...sendOpts,
                    chunks: formatError(defect),
                    ignoreErrors: true,
                  });
                }),
              ),
              Effect.annotateLogs("sessionId", info.sessionID),
              Effect.annotateLogs("chatId", session.value.chatId),
            );
          } else if (event.type === "session.error") {
            const { sessionID, error } = event.properties;
            if (!sessionID) {
              yield* Effect.logWarning(
                "Bot.service ignored a session.error without sessionID",
              );
              return;
            }
            const session = yield* database.session.findById(sessionID);
            if (Option.isNone(session)) {
              yield* Effect.logDebug(
                "Bot.service ignored a session.error for an unknown session",
              ).pipe(Effect.annotateLogs("sessionId", sessionID));
              return;
            }
            const sendOpts = {
              client,
              chatId: session.value.chatId,
              threadId: session.value.threadId || undefined,
              dmTopicId: session.value.dmTopicId || undefined,
            };
            yield* Effect.gen(function* () {
              yield* Effect.logWarning(error);
              yield* Bot.sendChunks({
                ...sendOpts,
                chunks: formatError(error),
                ignoreErrors: false,
              });
            }).pipe(
              Effect.catchAllDefect((defect) =>
                Effect.gen(function* () {
                  yield* Effect.logError(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.service"),
                  );
                  yield* Bot.sendChunks({
                    ...sendOpts,
                    chunks: formatError(defect),
                    ignoreErrors: true,
                  });
                }),
              ),
              Effect.annotateLogs("sessionId", sessionID),
              Effect.annotateLogs("chatId", session.value.chatId),
            );
          }
        });

      // Each iteration subscribes to the SSE stream, consumes events, and
      // cleans up the iterator via acquireRelease. On disconnect or error,
      // catchAllDefect logs and waits before the next iteration reconnects.
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
            }).pipe(Effect.flatMap(processEvent)),
          );
        }),
      );
      yield* Effect.forever(
        consumeEventStream.pipe(
          Effect.catchAllDefect(() =>
            Effect.logWarning("Bot.stream disconnected, reconnecting").pipe(
              Effect.andThen(Effect.sleep("5 seconds")),
            ),
          ),
        ),
      ).pipe(Effect.forkScoped);

      // grammY bot — error handler, message handler, and lifecycle
      client.catch(({ error, ctx }) =>
        Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            const cause = Runtime.isFiberFailure(error)
              ? Cause.squash(error[Runtime.FiberFailureCauseId])
              : error;
            yield* Effect.logError(cause);
            if (ctx.chat) {
              yield* Bot.sendChunks({
                client,
                chunks: formatError(cause),
                ignoreErrors: true,
                chatId: ctx.chat.id,
                threadId: ctx.message?.message_thread_id,
                dmTopicId: ctx.message?.direct_messages_topic?.topic_id,
              });
            }
          }).pipe(
            Effect.annotateLogs("debugHint", "Bot.service"),
            Effect.annotateLogs("userId", ctx.from?.id),
            Effect.annotateLogs("chatId", ctx.chat?.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
          ),
        ),
      );
      client.on("message:text", (ctx) => {
        const threadId = ctx.message?.message_thread_id;
        const dmTopicId = ctx.message?.direct_messages_topic?.topic_id;
        return Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            if (ctx.from?.id !== userId) {
              return yield* Effect.logWarning(
                "Bot.service ignored a message from an unauthorized user",
              );
            }
            yield* Effect.logTrace("Bot.service received a message");
            const sessionId = yield* Bot.findOrCreateSession({
              database,
              opencode,
              chatId: ctx.chat.id,
              threadId,
              dmTopicId,
            });
            const rejectBusy = Effect.gen(function* () {
              yield* Effect.logDebug(
                "Bot.service rejected a message while busy",
              ).pipe(Effect.annotateLogs("sessionId", sessionId));
              yield* Bot.sendChunks({
                client,
                chunks: formatBusy(),
                ignoreErrors: false,
                chatId: ctx.chat.id,
                threadId,
                dmTopicId,
              });
            });

            // Check if session is busy via status API
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

            yield* Effect.logTrace("Bot.service is prompting OpenCode").pipe(
              Effect.annotateLogs("sessionId", sessionId),
            );
            const result = yield* Effect.promise(() =>
              opencode.client.session.promptAsync({
                sessionID: sessionId,
                parts: [{ type: "text", text: ctx.message.text }],
              }),
            ).pipe(
              Effect.ensuring(
                Ref.update(promptingRef, HashSet.remove(sessionId)),
              ),
            );
            if (result.error) {
              return yield* Effect.die(result.error);
            }
            yield* Effect.logTrace("Bot.service prompted OpenCode").pipe(
              Effect.annotateLogs("sessionId", sessionId),
            );
          }).pipe(
            Effect.annotateLogs("userId", ctx.from?.id),
            Effect.annotateLogs("chatId", ctx.chat.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
          ),
        );
      });

      // Bot lifecycle — start, wait for ready, and register stop finalizer
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
   * Finds an existing session by chat IDs, or creates one. If a concurrent
   * insert races and wins, catches the unique-constraint defect and re-lookups.
   */
  static findOrCreateSession({
    database,
    opencode,
    chatId,
    threadId,
    dmTopicId,
  }: Bot.FindOrCreateSessionOptions) {
    const dbThreadId = threadId ?? 0;
    const dbDmTopicId = dmTopicId ?? 0;
    return Effect.gen(function* () {
      const existing = yield* database.session.findByChat({
        chatId,
        threadId: dbThreadId,
        dmTopicId: dbDmTopicId,
      });
      if (Option.isSome(existing)) {
        yield* Effect.logDebug("Bot.service reused an existing session").pipe(
          Effect.annotateLogs("sessionId", existing.value.id),
        );
        return existing.value.id;
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
          threadId: dbThreadId,
          dmTopicId: dbDmTopicId,
          createdAt: undefined,
          updatedAt: undefined,
        })
        .pipe(
          Effect.tap(
            Effect.logInfo("Bot.service created a new session").pipe(
              Effect.annotateLogs("sessionId", sessionId),
            ),
          ),
          Effect.as(sessionId),
          Effect.catchAllDefect((defect) =>
            Effect.gen(function* () {
              const raced = yield* database.session.findByChat({
                chatId,
                threadId: dbThreadId,
                dmTopicId: dbDmTopicId,
              });
              if (Option.isNone(raced)) return yield* Effect.die(defect);
              // Clean up the orphaned OpenCode session from the losing race
              const deleteResult = yield* Effect.promise(() =>
                opencode.client.session.delete({ sessionID: sessionId }),
              );
              if (deleteResult.error)
                return yield* Effect.die(deleteResult.error);
              yield* Effect.logDebug(
                "Bot.service resolved a concurrent session insert",
              ).pipe(Effect.annotateLogs("sessionId", raced.value.id));
              return raced.value.id;
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
    dmTopicId,
  }: Bot.SendChunksOptions) {
    const threadOpts = {
      ...(threadId !== undefined && { message_thread_id: threadId }),
      ...(dmTopicId !== undefined && { direct_messages_topic_id: dmTopicId }),
    };
    return Effect.forEach(
      chunks,
      ({ text, markdown }) => {
        const sendEffect = Effect.promise(() =>
          markdown
            ? client.api
                .sendMessage(chatId, markdown, {
                  parse_mode: "MarkdownV2",
                  ...threadOpts,
                })
                .catch(() => client.api.sendMessage(chatId, text, threadOpts))
            : client.api.sendMessage(chatId, text, threadOpts),
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
    readonly dmTopicId: number | undefined;
  }

  export interface SendChunksOptions {
    readonly client: GrammyBot;
    readonly chunks: ReturnType<typeof formatMessage>;
    readonly ignoreErrors: boolean;
    readonly chatId: number;
    readonly threadId: number | undefined;
    readonly dmTopicId: number | undefined;
  }
}
