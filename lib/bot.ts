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
import { Bot as GrammyBot, type Context as GrammyContext } from "grammy";
import { Database } from "~/lib/database";
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
      // can resolve the handler's Deferred when a response arrives.
      const pendingRef = yield* Ref.make(
        HashMap.empty<string, Bot.PendingPrompt>(),
      );

      /** Handles a single SSE event: resolves or fails the pending handler's Deferred. */
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
            if (Option.isNone(pending)) return;
            const { sendChunks, done } = pending.value;
            // Fetch the full message to get all parts (text, tool, etc.)
            const msgResult = yield* Effect.promise(() =>
              opencode.client.session.message({
                sessionID: info.sessionID,
                messageID: info.id,
              }),
            );
            if (msgResult.error) {
              yield* Ref.update(pendingRef, HashMap.remove(info.sessionID));
              return yield* Deferred.die(done, msgResult.error);
            }
            const replyText = msgResult.data.parts
              .filter(isTextPart)
              .map((p) => p.text)
              .filter(Boolean)
              .join("\n")
              .trim();
            if (replyText) {
              yield* sendChunks(formatMessage(replyText), {
                ignoreErrors: false,
              });
              yield* Effect.logTrace("Bot.service sent a reply");
            } else {
              yield* Effect.logWarning(
                "Bot.service received an empty response",
              );
            }
            yield* Ref.update(pendingRef, HashMap.remove(info.sessionID));
            yield* Deferred.succeed(done, undefined);
          } else if (event.type === "session.error") {
            const { sessionID, error } = event.properties;
            if (!sessionID) return;
            const pending = HashMap.get(yield* Ref.get(pendingRef), sessionID);
            if (Option.isNone(pending)) return;
            const { sendChunks, done } = pending.value;
            yield* sendChunks(formatError(error), {
              ignoreErrors: false,
            });
            yield* Ref.update(pendingRef, HashMap.remove(sessionID));
            yield* Deferred.die(done, error);
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
      ).pipe(Effect.annotateLogs("debugHint", "Bot.stream"), Effect.forkScoped);

      // Fail all pending deferreds on shutdown so handler fibers don't hang
      yield* Effect.addFinalizer(() =>
        Effect.gen(function* () {
          const pending = yield* Ref.get(pendingRef);
          yield* Effect.forEach(
            HashMap.values(pending),
            ({ done }) =>
              Deferred.die(done, new Error("Bot.service is shutting down")),
            { discard: true },
          );
        }),
      );

      // grammY bot — error handler, message handler, and lifecycle
      const grammyBot = new GrammyBot(Redacted.value(redactedToken));
      grammyBot.catch(({ error, ctx }) =>
        Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            const cause = Runtime.isFiberFailure(error)
              ? Cause.squash(error[Runtime.FiberFailureCauseId])
              : error;
            yield* Effect.logError(cause);
            yield* Bot.sendChunks(ctx, formatError(cause), {
              ignoreErrors: true,
            });
          }).pipe(
            Effect.annotateLogs("debugHint", "Bot.handle"),
            Effect.annotateLogs("userId", ctx.from?.id),
            Effect.annotateLogs("chatId", ctx.chat?.id),
            Effect.annotateLogs("messageId", ctx.message?.message_id),
          ),
        ),
      );
      grammyBot.on("message:text", (ctx) => {
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
            yield* Effect.logTrace("Bot.service is prompting OpenCode").pipe(
              Effect.annotateLogs("sessionId", sessionId),
            );

            // Register pending prompt before firing async prompt
            const done = yield* Deferred.make<void>();
            const sendChunks = (
              chunks: ReturnType<typeof formatMessage>,
              opts: Bot.SendChunksOptions,
            ) => Bot.sendChunks(ctx, chunks, opts);
            yield* Ref.update(
              pendingRef,
              HashMap.set(sessionId, { sendChunks, done }),
            );

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

            // Wait for event stream to resolve
            yield* Deferred.await(done);
          }).pipe(
            Effect.annotateLogs("debugHint", "Bot.handle"),
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
              Effect.annotateLogs("debugHint", "Bot.stop"),
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
    ctx: GrammyContext,
    chunks: ReturnType<typeof formatMessage>,
    { ignoreErrors }: Bot.SendChunksOptions,
  ) {
    return Effect.forEach(
      chunks,
      ({ text, markdown }) => {
        const sendEffect = Effect.promise(() =>
          markdown
            ? ctx
                .reply(markdown, { parse_mode: "MarkdownV2" })
                .catch(() => ctx.reply(text))
            : ctx.reply(text),
        );
        return ignoreErrors ? Effect.ignoreLogged(sendEffect) : sendEffect;
      },
      { discard: true },
    );
  }
}

export namespace Bot {
  export interface PendingPrompt {
    readonly sendChunks: (
      chunks: ReturnType<typeof formatMessage>,
      opts: Bot.SendChunksOptions,
    ) => Effect.Effect<void>;
    readonly done: Deferred.Deferred<void>;
  }
  export interface SendChunksOptions {
    ignoreErrors: boolean;
  }
}
