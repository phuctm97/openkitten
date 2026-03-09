import type { Event } from "@opencode-ai/sdk/v2";
import {
  Cause,
  Config,
  Context,
  Deferred,
  Effect,
  Exit,
  type Fiber,
  HashMap,
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
  { readonly fiber: Fiber.RuntimeFiber<void> }
>() {
  /** Manages the grammY bot lifecycle, SSE event stream, and pending prompt coordination. */
  static readonly layer = Layer.scoped(
    Bot,
    Effect.gen(function* () {
      yield* Effect.logDebug("Bot.service is starting");
      const redactedToken = yield* Config.redacted("TELEGRAM_BOT_TOKEN");
      const userId = yield* Config.integer("TELEGRAM_USER_ID");
      const runtime = yield* Effect.runtime<Database>();
      const opencode = yield* OpenCode;

      // Tracks in-flight prompts keyed by sessionId so the event stream fiber
      // can send the reply to Telegram when a response arrives.
      const pendingRef = yield* Ref.make(
        HashMap.empty<string, Bot.PendingPrompt>(),
      );

      // grammY bot — created early so processEvent can use grammyBot.api.
      // Handlers and lifecycle are registered further below.
      const grammyBot = new GrammyBot(Redacted.value(redactedToken));

      /** Handles a single SSE event: sends the reply or error to Telegram. */
      const processEvent = (event: Event) =>
        Effect.gen(function* () {
          if (event.type === "message.updated") {
            const { info } = event.properties;
            // Only act on fully completed assistant messages
            if (info.role !== "assistant" || info.time.completed === undefined)
              return;
            const pending = HashMap.get(
              yield* Ref.get(pendingRef),
              info.sessionID,
            );
            if (Option.isNone(pending)) {
              yield* Effect.logWarning(
                "Bot.service ignored a message.updated for an unknown session",
              ).pipe(Effect.annotateLogs("sessionId", info.sessionID));
              return;
            }
            const { userId, chatId, threadId, dmTopicId } = pending.value;
            yield* Ref.update(pendingRef, HashMap.remove(info.sessionID));
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
                yield* Bot.sendChunks(
                  grammyBot,
                  chatId,
                  formatError(msgResult.error),
                  { ignoreErrors: false, threadId, dmTopicId },
                );
                return;
              }
              const replyText = msgResult.data.parts
                .filter(isTextPart)
                .map((p) => p.text)
                .filter(Boolean)
                .join("\n")
                .trim();
              if (replyText) {
                yield* Bot.sendChunks(
                  grammyBot,
                  chatId,
                  formatMessage(replyText),
                  { ignoreErrors: false, threadId, dmTopicId },
                );
                yield* Effect.logTrace("Bot.service sent a reply");
              } else {
                yield* Effect.logWarning(
                  "Bot.service received an empty response",
                );
              }
            }).pipe(
              Effect.catchAllDefect((defect) =>
                Effect.gen(function* () {
                  yield* Effect.logError(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.service"),
                  );
                  yield* Bot.sendChunks(
                    grammyBot,
                    chatId,
                    formatError(defect),
                    { ignoreErrors: true, threadId, dmTopicId },
                  );
                }),
              ),
              Effect.annotateLogs("sessionId", info.sessionID),
              Effect.annotateLogs("userId", userId),
              Effect.annotateLogs("chatId", chatId),
            );
          } else if (event.type === "session.error") {
            const { sessionID, error } = event.properties;
            if (!sessionID) {
              yield* Effect.logWarning(
                "Bot.service ignored a session.error without sessionID",
              );
              return;
            }
            const pending = HashMap.get(yield* Ref.get(pendingRef), sessionID);
            if (Option.isNone(pending)) {
              yield* Effect.logWarning(
                "Bot.service ignored a session.error for an unknown session",
              ).pipe(Effect.annotateLogs("sessionId", sessionID));
              return;
            }
            const { userId, chatId, threadId, dmTopicId } = pending.value;
            yield* Ref.update(pendingRef, HashMap.remove(sessionID));
            yield* Effect.gen(function* () {
              yield* Effect.logWarning(error);
              yield* Bot.sendChunks(grammyBot, chatId, formatError(error), {
                ignoreErrors: false,
                threadId,
                dmTopicId,
              });
            }).pipe(
              Effect.catchAllDefect((defect) =>
                Effect.gen(function* () {
                  yield* Effect.logError(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.service"),
                  );
                  yield* Bot.sendChunks(
                    grammyBot,
                    chatId,
                    formatError(defect),
                    { ignoreErrors: true, threadId, dmTopicId },
                  );
                }),
              ),
              Effect.annotateLogs("sessionId", sessionID),
              Effect.annotateLogs("userId", userId),
              Effect.annotateLogs("chatId", chatId),
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
      grammyBot.catch(({ error, ctx }) =>
        Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            const cause = Runtime.isFiberFailure(error)
              ? Cause.squash(error[Runtime.FiberFailureCauseId])
              : error;
            yield* Effect.logError(cause);
            if (ctx.chat) {
              yield* Bot.sendChunks(
                grammyBot,
                ctx.chat.id,
                formatError(cause),
                {
                  ignoreErrors: true,
                  threadId: ctx.message?.message_thread_id,
                  dmTopicId: ctx.message?.direct_messages_topic?.topic_id,
                },
              );
            }
          }).pipe(
            Effect.annotateLogs("debugHint", "Bot.service"),
            Effect.annotateLogs("userId", ctx.from?.id),
            Effect.annotateLogs("chatId", ctx.chat?.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
          ),
        ),
      );
      grammyBot.on("message:text", (ctx) => {
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
            const database = yield* Database;
            const profile = yield* database.profile.findById("default");
            let sessionId: string;
            if (
              Option.isSome(profile) &&
              Option.isSome(profile.value.activeSessionId)
            ) {
              sessionId = profile.value.activeSessionId.value;
              yield* Effect.logDebug(
                "Bot.service reused an existing session",
              ).pipe(Effect.annotateLogs("sessionId", sessionId));
            } else {
              const result = yield* Effect.promise(() =>
                opencode.client.session.create({}),
              );
              if (result.error) return yield* Effect.die(result.error);
              sessionId = result.data.id;
              yield* Effect.logInfo("Bot.service created a new session").pipe(
                Effect.annotateLogs("sessionId", sessionId),
              );
              if (Option.isNone(profile)) {
                yield* database.profile.insert({
                  id: "default",
                  activeSessionId: Option.some(sessionId),
                  createdAt: undefined,
                  updatedAt: undefined,
                });
              } else {
                yield* database.profile.update({
                  id: profile.value.id,
                  activeSessionId: Option.some(sessionId),
                  updatedAt: undefined,
                });
              }
            }
            // Reject if the session already has a pending prompt
            const existing = HashMap.get(yield* Ref.get(pendingRef), sessionId);
            if (Option.isSome(existing)) {
              yield* Effect.logDebug(
                "Bot.service rejected a message while busy",
              ).pipe(Effect.annotateLogs("sessionId", sessionId));
              yield* Bot.sendChunks(grammyBot, ctx.chat.id, formatBusy(), {
                ignoreErrors: false,
                threadId,
                dmTopicId,
              });
              return;
            }

            yield* Effect.logTrace("Bot.service is prompting OpenCode").pipe(
              Effect.annotateLogs("sessionId", sessionId),
            );

            // Register pending prompt before firing async prompt
            const pending: Bot.PendingPrompt = {
              userId: ctx.from?.id,
              chatId: ctx.chat.id,
              threadId,
              dmTopicId,
            };
            yield* Ref.update(pendingRef, HashMap.set(sessionId, pending));

            const result = yield* Effect.promise(() =>
              opencode.client.session.promptAsync({
                sessionID: sessionId,
                parts: [{ type: "text", text: ctx.message.text }],
              }),
            );
            if (result.error) {
              yield* Ref.update(pendingRef, HashMap.remove(sessionId));
              return yield* Effect.die(result.error);
            }
          }).pipe(
            Effect.annotateLogs("userId", ctx.from?.id),
            Effect.annotateLogs("chatId", ctx.chat.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
          ),
        );
      });
      const ready = yield* Deferred.make<void>();
      const fiber = yield* Effect.acquireRelease(
        Effect.async<void>((resume) => {
          grammyBot
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
            yield* Effect.promise(() => grammyBot.stop()).pipe(
              Effect.ignoreLogged,
            );
            yield* Effect.logInfo("Bot.service has stopped");
          }),
      );
      yield* Deferred.await(ready);
      yield* Effect.logInfo("Bot.service is ready");
      return Bot.of({ fiber });
    }),
  );

  /** Sends chunks to Telegram, falling back to plain text if MarkdownV2 fails. */
  static sendChunks(
    bot: GrammyBot,
    chatId: number,
    chunks: ReturnType<typeof formatMessage>,
    { ignoreErrors, threadId, dmTopicId }: Bot.SendChunksOptions,
  ) {
    const threadOpts = {
      ...(threadId !== undefined && { message_thread_id: threadId }),
      ...(dmTopicId !== undefined && { direct_messages_topic_id: dmTopicId }),
    };
    return Effect.forEach(
      chunks,
      ({ text, markdown }) => {
        const sendEffect = Effect.promise(() =>
          markdown
            ? bot.api
                .sendMessage(chatId, markdown, {
                  parse_mode: "MarkdownV2",
                  ...threadOpts,
                })
                .catch(() => bot.api.sendMessage(chatId, text, threadOpts))
            : bot.api.sendMessage(chatId, text, threadOpts),
        );
        return ignoreErrors ? Effect.ignoreLogged(sendEffect) : sendEffect;
      },
      { discard: true },
    );
  }
}

export namespace Bot {
  export interface PendingPrompt {
    readonly userId: number | undefined;
    readonly chatId: number;
    readonly threadId: number | undefined;
    readonly dmTopicId: number | undefined;
  }
  export interface SendChunksOptions {
    ignoreErrors: boolean;
    threadId?: number | undefined;
    dmTopicId?: number | undefined;
  }
}
