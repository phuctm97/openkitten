import type {
  AssistantMessage,
  Event,
  PermissionRequest,
  QuestionInfo,
  QuestionRequest,
} from "@opencode-ai/sdk/v2";
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
import { Bot as GrammyBot, InlineKeyboard } from "grammy";
import invariant from "tiny-invariant";
import { Database } from "~/lib/database";
import { formatBusy } from "~/lib/format-busy";
import { formatCompact } from "~/lib/format-compact";
import { formatError } from "~/lib/format-error";
import { formatMessage, type MessageChunk } from "~/lib/format-message";
import { formatPermissionMessage } from "~/lib/format-permission-message";
import { formatPermissionPending } from "~/lib/format-permission-pending";
import { formatPermissionPrompt } from "~/lib/format-permission-prompt";
import { formatPermissionReplied } from "~/lib/format-permission-replied";
import { formatQuestionMessage } from "~/lib/format-question-message";
import { formatQuestionPending } from "~/lib/format-question-pending";
import { formatQuestionPrompt } from "~/lib/format-question-prompt";
import { formatQuestionRejected } from "~/lib/format-question-rejected";
import { formatQuestionReplied } from "~/lib/format-question-replied";
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

      // Pending question state — maps local short IDs to question requests.
      const pendingQuestions = yield* Ref.make(
        HashMap.empty<string, Bot.PendingQuestion>(),
      );
      const questionCounter = yield* Ref.make(0);
      const emptySelection: string[] = [];

      // Pending permission state — maps local short IDs to permission requests.
      const pendingPermissions = yield* Ref.make(
        HashMap.empty<string, Bot.PendingPermission>(),
      );
      const permissionCounter = yield* Ref.make(0);

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

      // --- Question helpers ---

      /** Builds an InlineKeyboard for a question's options. */
      const buildQuestionKeyboard = (
        localId: string,
        question: QuestionInfo,
        selected: ReadonlyArray<string>,
      ) => {
        const kb = new InlineKeyboard();
        for (const [i, opt] of question.options.entries()) {
          const isSelected = selected.includes(opt.label);
          const label = isSelected ? `✓ ${opt.label}` : opt.label;
          // Telegram limits button text reasonably but callback_data to 64 bytes
          kb.text(label, `q:${localId}:${i}`);
          // Two buttons per row for readability
          if (i % 2 === 1) kb.row();
        }
        if (question.options.length % 2 === 1) kb.row();
        if (question.multiple) kb.text("Confirm", `qc:${localId}`).row();
        kb.text("Dismiss", `qr:${localId}`);
        return kb;
      };

      /** Sends the current question in a pending request to Telegram. */
      const sendCurrentQuestion = (pq: Bot.PendingQuestion) =>
        Effect.gen(function* () {
          const question = pq.questions[pq.currentIndex];
          invariant(question, "question");
          const sendOpts = {
            ...(pq.threadId && { message_thread_id: pq.threadId }),
          };
          // Message 1: sticky question content
          yield* Bot.sendChunks({
            client,
            chunks: yield* formatQuestionMessage(question),
            ignoreErrors: false,
            chatId: pq.chatId,
            threadId: pq.threadId,
          });
          // Message 2: interaction prompt with keyboard
          const promptText = formatQuestionPrompt(question);
          const kb = buildQuestionKeyboard(pq.localId, question, []);
          const sent = yield* Effect.promise(() =>
            client.api.sendMessage(pq.chatId, promptText, {
              parse_mode: "MarkdownV2",
              reply_markup: kb,
              ...sendOpts,
            }),
          );
          yield* Ref.update(
            pendingQuestions,
            HashMap.set(pq.localId, {
              ...pq,
              interactionMessageId: sent.message_id,
              selected: emptySelection,
            }),
          );
        }).pipe(
          Effect.annotateLogs("sessionId", pq.sessionId),
          Effect.annotateLogs("chatId", pq.chatId),
          Effect.annotateLogs("threadId", pq.threadId),
        );

      /** Processes a question.asked event or reconciled pending question. */
      const processQuestionAsked = (
        request: QuestionRequest,
        session: Database.Session,
      ) =>
        Effect.gen(function* () {
          const localId = yield* Ref.getAndUpdate(
            questionCounter,
            (n) => n + 1,
          ).pipe(Effect.map((n) => n.toString(36)));
          const pq: Bot.PendingQuestion = {
            localId,
            requestId: request.id,
            sessionId: request.sessionID,
            chatId: session.chatId,
            threadId: session.threadId || undefined,
            questions: request.questions,
            currentIndex: 0,
            answers: [],
            interactionMessageId: 0,
            selected: emptySelection,
          };
          yield* Ref.update(pendingQuestions, HashMap.set(localId, pq));
          yield* sendCurrentQuestion(pq);
        }).pipe(
          Effect.annotateLogs("requestId", request.id),
          Effect.annotateLogs("sessionId", request.sessionID),
        );

      /** Records an answer for the current question and advances or submits. */
      const advanceOrSubmit = (localId: string, answer: string[]) =>
        Effect.gen(function* () {
          const maybePq = HashMap.get(
            yield* Ref.get(pendingQuestions),
            localId,
          );
          invariant(Option.isSome(maybePq), "pendingQuestion");
          const pq = maybePq.value;
          const newAnswers = [...pq.answers, answer];
          const nextIndex = pq.currentIndex + 1;
          // Edit the interaction message to show the answer
          yield* Effect.promise(() =>
            client.api.editMessageText(
              pq.chatId,
              pq.interactionMessageId,
              formatQuestionReplied(answer),
            ),
          ).pipe(Effect.ignoreLogged);
          if (nextIndex < pq.questions.length) {
            // More questions — advance
            const updated: Bot.PendingQuestion = {
              ...pq,
              currentIndex: nextIndex,
              answers: newAnswers,
              selected: emptySelection,
            };
            yield* Ref.update(pendingQuestions, HashMap.set(localId, updated));
            yield* sendCurrentQuestion(updated);
          } else {
            // All answered — submit
            yield* Ref.update(pendingQuestions, HashMap.remove(localId));
            yield* Effect.promise(() =>
              opencode.client.question.reply({
                requestID: pq.requestId,
                answers: newAnswers,
              }),
            ).pipe(
              Effect.tap(Effect.logDebug("Bot.service answered the question")),
            );
          }
        }).pipe(Effect.annotateLogs("localId", localId));

      /** Finds a pending question by requestId. */
      const findPendingByRequestId = (requestId: string) =>
        Ref.get(pendingQuestions).pipe(
          Effect.map((map) =>
            HashMap.findFirst(map, (pq) => pq.requestId === requestId).pipe(
              Option.map(([, pq]) => pq),
            ),
          ),
        );

      /** Finds a pending question by chatId and threadId. */
      const findPendingByChat = (
        chatId: number,
        threadId: number | undefined,
      ) =>
        Ref.get(pendingQuestions).pipe(
          Effect.map((map) =>
            HashMap.findFirst(
              map,
              (pq) => pq.chatId === chatId && pq.threadId === threadId,
            ).pipe(Option.map(([, pq]) => pq)),
          ),
        );

      // --- Permission helpers ---

      /** Builds an InlineKeyboard for a permission request. */
      const buildPermissionKeyboard = (localId: string) => {
        const kb = new InlineKeyboard();
        kb.text("Allow (once)", `p:${localId}:once`);
        kb.text("Allow (always)", `p:${localId}:always`);
        kb.row();
        kb.text("Deny", `pr:${localId}`);
        return kb;
      };

      /** Sends a permission request to Telegram. */
      const sendPermission = (pp: Bot.PendingPermission) =>
        Effect.gen(function* () {
          const sendOpts = {
            ...(pp.threadId && { message_thread_id: pp.threadId }),
          };
          // Message 1: sticky permission content
          yield* Bot.sendChunks({
            client,
            chunks: yield* formatPermissionMessage(pp.request),
            ignoreErrors: false,
            chatId: pp.chatId,
            threadId: pp.threadId,
          });
          // Message 2: interaction prompt with keyboard
          const promptText = formatPermissionPrompt();
          const kb = buildPermissionKeyboard(pp.localId);
          const sent = yield* Effect.promise(() =>
            client.api.sendMessage(pp.chatId, promptText, {
              parse_mode: "MarkdownV2",
              reply_markup: kb,
              ...sendOpts,
            }),
          );
          yield* Ref.update(
            pendingPermissions,
            HashMap.set(pp.localId, {
              ...pp,
              interactionMessageId: sent.message_id,
            }),
          );
        }).pipe(
          Effect.annotateLogs("sessionId", pp.request.sessionID),
          Effect.annotateLogs("chatId", pp.chatId),
          Effect.annotateLogs("threadId", pp.threadId),
        );

      /** Processes a permission.asked event or reconciled pending permission. */
      const processPermissionAsked = (
        request: PermissionRequest,
        session: Database.Session,
      ) =>
        Effect.gen(function* () {
          const localId = yield* Ref.getAndUpdate(
            permissionCounter,
            (n) => n + 1,
          ).pipe(Effect.map((n) => `p${n.toString(36)}`));
          const pp: Bot.PendingPermission = {
            localId,
            request,
            chatId: session.chatId,
            threadId: session.threadId || undefined,
            interactionMessageId: 0,
          };
          yield* Ref.update(pendingPermissions, HashMap.set(localId, pp));
          yield* sendPermission(pp);
        }).pipe(
          Effect.annotateLogs("requestId", request.id),
          Effect.annotateLogs("sessionId", request.sessionID),
        );

      /** Finds a pending permission by requestId. */
      const findPendingPermissionByRequestId = (requestId: string) =>
        Ref.get(pendingPermissions).pipe(
          Effect.map((map) =>
            HashMap.findFirst(map, (pp) => pp.request.id === requestId).pipe(
              Option.map(([, pp]) => pp),
            ),
          ),
        );

      /** Finds a pending permission by chatId and threadId. */
      const findPendingPermissionByChat = (
        chatId: number,
        threadId: number | undefined,
      ) =>
        Ref.get(pendingPermissions).pipe(
          Effect.map((map) =>
            HashMap.findFirst(
              map,
              (pp) => pp.chatId === chatId && pp.threadId === threadId,
            ).pipe(Option.map(([, pp]) => pp)),
          ),
        );

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
          Effect.annotateLogs("messageId", message.id),
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
          } else if (event.type === "session.compacted") {
            const { sessionID } = event.properties;
            const session = yield* database.session.findById(sessionID);
            if (Option.isNone(session)) {
              yield* Effect.logDebug(
                "Bot.service ignored a session.compacted from an unknown session",
              ).pipe(Effect.annotateLogs("sessionId", sessionID));
            } else {
              yield* Bot.sendChunks({
                client,
                chunks: yield* formatCompact(),
                ignoreErrors: false,
                chatId: session.value.chatId,
                threadId: session.value.threadId || undefined,
              }).pipe(
                Effect.annotateLogs("sessionId", sessionID),
                Effect.annotateLogs("chatId", session.value.chatId),
                Effect.annotateLogs(
                  "threadId",
                  session.value.threadId || undefined,
                ),
              );
            }
          } else if (event.type === "question.asked") {
            const request = event.properties;
            const session = yield* database.session.findById(request.sessionID);
            if (Option.isNone(session)) {
              yield* Effect.logDebug(
                "Bot.service ignored a question.asked from an unknown session",
              ).pipe(Effect.annotateLogs("sessionId", request.sessionID));
            } else {
              yield* processQuestionAsked(request, session.value);
            }
          } else if (event.type === "question.replied") {
            const { requestID, answers } = event.properties;
            const pq = yield* findPendingByRequestId(requestID);
            if (Option.isSome(pq)) {
              yield* Ref.update(
                pendingQuestions,
                HashMap.remove(pq.value.localId),
              );
              const allAnswers = answers.flat();
              yield* Effect.promise(() =>
                client.api.editMessageText(
                  pq.value.chatId,
                  pq.value.interactionMessageId,
                  formatQuestionReplied(allAnswers),
                ),
              ).pipe(Effect.ignoreLogged);
            }
          } else if (event.type === "question.rejected") {
            const { requestID } = event.properties;
            const pq = yield* findPendingByRequestId(requestID);
            if (Option.isSome(pq)) {
              yield* Ref.update(
                pendingQuestions,
                HashMap.remove(pq.value.localId),
              );
              yield* Effect.promise(() =>
                client.api.editMessageText(
                  pq.value.chatId,
                  pq.value.interactionMessageId,
                  formatQuestionRejected(),
                ),
              ).pipe(Effect.ignoreLogged);
            }
          } else if (event.type === "permission.asked") {
            const request = event.properties;
            const session = yield* database.session.findById(request.sessionID);
            if (Option.isNone(session)) {
              yield* Effect.logDebug(
                "Bot.service ignored a permission.asked from an unknown session",
              ).pipe(Effect.annotateLogs("sessionId", request.sessionID));
            } else {
              yield* processPermissionAsked(request, session.value);
            }
          } else if (event.type === "permission.replied") {
            const { requestID, reply } = event.properties;
            const pp = yield* findPendingPermissionByRequestId(requestID);
            if (Option.isSome(pp)) {
              yield* Ref.update(
                pendingPermissions,
                HashMap.remove(pp.value.localId),
              );
              yield* Effect.promise(() =>
                client.api.editMessageText(
                  pp.value.chatId,
                  pp.value.interactionMessageId,
                  formatPermissionReplied(reply),
                ),
              ).pipe(Effect.ignoreLogged);
            }
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
          // Reconcile messages — deliver assistant messages that completed
          // while disconnected. Expands the fetch window per session until
          // an already-delivered message is found. Sessions run in parallel.
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
                Effect.annotateLogs("chatId", session.chatId),
                Effect.annotateLogs("threadId", session.threadId || undefined),
              ),
            { concurrency: "unbounded", discard: true },
          );
          // Reconcile questions and typing indicators concurrently.
          yield* Effect.all(
            [
              // Reconcile questions — clear stale entries and re-send
              // pending questions that arrived while disconnected.
              Effect.gen(function* () {
                const pendingResult = yield* Effect.promise(() =>
                  opencode.client.question.list({}),
                );
                if (pendingResult.error) {
                  return yield* Effect.die(pendingResult.error);
                }
                invariant(pendingResult.data, "question.list data");
                const pendingData = pendingResult.data;
                // Clear stale entries whose requestId is no longer pending
                const currentMap = yield* Ref.get(pendingQuestions);
                const pendingIds = new Set(pendingData.map((q) => q.id));
                for (const [localId, pq] of HashMap.entries(currentMap)) {
                  if (!pendingIds.has(pq.requestId)) {
                    yield* Ref.update(
                      pendingQuestions,
                      HashMap.remove(localId),
                    );
                  }
                }
                // Re-send questions that belong to tracked sessions
                for (const qr of pendingData) {
                  const existing = yield* findPendingByRequestId(qr.id);
                  if (Option.isSome(existing)) continue;
                  const session = yield* database.session.findById(
                    qr.sessionID,
                  );
                  if (Option.isSome(session)) {
                    yield* processQuestionAsked(qr, session.value);
                  }
                }
              }).pipe(
                Effect.catchAllDefect((defect) =>
                  Effect.logWarning(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.reconcileQuestions"),
                  ),
                ),
              ),
              // Reconcile permissions — clear stale entries and re-send
              // pending permissions that arrived while disconnected.
              Effect.gen(function* () {
                const pendingResult = yield* Effect.promise(() =>
                  opencode.client.permission.list({}),
                );
                if (pendingResult.error) {
                  return yield* Effect.die(pendingResult.error);
                }
                invariant(pendingResult.data, "permission.list data");
                const pendingData = pendingResult.data;
                // Clear stale entries whose requestId is no longer pending
                const currentMap = yield* Ref.get(pendingPermissions);
                const pendingIds = new Set(pendingData.map((p) => p.id));
                for (const [localId, pp] of HashMap.entries(currentMap)) {
                  if (!pendingIds.has(pp.request.id)) {
                    yield* Ref.update(
                      pendingPermissions,
                      HashMap.remove(localId),
                    );
                  }
                }
                // Re-send permissions that belong to tracked sessions
                for (const pr of pendingData) {
                  const existing = yield* findPendingPermissionByRequestId(
                    pr.id,
                  );
                  if (Option.isSome(existing)) continue;
                  const session = yield* database.session.findById(
                    pr.sessionID,
                  );
                  if (Option.isSome(session)) {
                    yield* processPermissionAsked(pr, session.value);
                  }
                }
              }).pipe(
                Effect.catchAllDefect((defect) =>
                  Effect.logWarning(defect).pipe(
                    Effect.annotateLogs(
                      "debugHint",
                      "Bot.reconcilePermissions",
                    ),
                  ),
                ),
              ),
              // Reconcile typing indicators — start typing for busy/retry
              // sessions and stop typing for idle/unknown ones.
              Effect.gen(function* () {
                const statusResult = yield* Effect.promise(() =>
                  opencode.client.session.status({}),
                );
                if (statusResult.error)
                  return yield* Effect.die(statusResult.error);
                for (const session of sessions) {
                  const status = statusResult.data[session.id];
                  if (status?.type === "busy" || status?.type === "retry") {
                    yield* startTyping(
                      session.id,
                      session.chatId,
                      session.threadId || undefined,
                    );
                  } else {
                    yield* stopTyping(session.id);
                  }
                }
              }).pipe(
                Effect.catchAllDefect((defect) =>
                  Effect.logWarning(defect).pipe(
                    Effect.annotateLogs("debugHint", "Bot.reconcileTyping"),
                  ),
                ),
              ),
            ],
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
              ).pipe(
                Effect.annotateLogs("attempt", attempt),
                Effect.annotateLogs("delay", `${delay}ms`),
              );
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

      // Finds or creates a session and greets the user.
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
          }).pipe(Effect.annotateLogs("sessionId", sessionId));
        }),
      );

      // Aborts in-flight generation. No-ops without an active session.
      // Notification is sent by the session.error event handler.
      registerCommand("stop", ({ chatId, threadId }) =>
        Effect.gen(function* () {
          const existing = yield* database.session.findByChat({
            chatId,
            threadId: threadId || 0,
          });
          if (Option.isNone(existing)) return;
          const sessionId = existing.value.id;
          yield* Effect.gen(function* () {
            const result = yield* Effect.promise(() =>
              opencode.client.session.abort({ sessionID: sessionId }),
            );
            if (result.error) return yield* Effect.die(result.error);
          }).pipe(Effect.annotateLogs("sessionId", sessionId));
        }),
      );

      // Summarizes the conversation to free up context. No-ops without an active session.
      // Notification is sent by the session.compacted event handler.
      registerCommand("compact", ({ chatId, threadId }) =>
        Effect.gen(function* () {
          const existing = yield* database.session.findByChat({
            chatId,
            threadId: threadId || 0,
          });
          if (Option.isNone(existing)) return;
          const sessionId = existing.value.id;
          yield* Effect.gen(function* () {
            const result = yield* Effect.promise(() =>
              opencode.client.session.summarize({ sessionID: sessionId }),
            );
            if (result.error) return yield* Effect.die(result.error);
          }).pipe(Effect.annotateLogs("sessionId", sessionId));
        }),
      );

      // Tears down the current session. No-ops without an active session.
      // 1. Abort any in-flight generation
      // 2. Stop typing indicator and clear prompting guard
      // 3. Delete the session from the local DB
      // 4. Send the reset message
      registerCommand("reset", ({ chatId, threadId }) =>
        Effect.gen(function* () {
          const existing = yield* database.session.findByChat({
            chatId,
            threadId: threadId || 0,
          });
          if (Option.isNone(existing)) return;
          const sessionId = existing.value.id;
          yield* Effect.gen(function* () {
            const abortResult = yield* Effect.promise(() =>
              opencode.client.session.abort({ sessionID: sessionId }),
            );
            if (abortResult.error) return yield* Effect.die(abortResult.error);
            yield* stopTyping(sessionId);
            yield* Ref.update(promptingRef, HashSet.remove(sessionId));
            // Reject any pending questions for this session
            const pending = yield* Ref.get(pendingQuestions);
            for (const [localId, pq] of HashMap.entries(pending)) {
              if (pq.sessionId === sessionId) {
                yield* Effect.promise(() =>
                  Promise.all([
                    opencode.client.question.reject({
                      requestID: pq.requestId,
                    }),
                    client.api.editMessageText(
                      pq.chatId,
                      pq.interactionMessageId,
                      formatQuestionRejected(),
                    ),
                  ]),
                ).pipe(Effect.ignoreLogged);
                yield* Ref.update(pendingQuestions, HashMap.remove(localId));
              }
            }
            // Reject any pending permissions for this session
            const pendingPerms = yield* Ref.get(pendingPermissions);
            for (const [localId, pp] of HashMap.entries(pendingPerms)) {
              if (pp.request.sessionID === sessionId) {
                yield* Effect.promise(() =>
                  Promise.all([
                    opencode.client.permission.reply({
                      requestID: pp.request.id,
                      reply: "reject",
                    }),
                    client.api.editMessageText(
                      pp.chatId,
                      pp.interactionMessageId,
                      formatPermissionReplied("reject"),
                    ),
                  ]),
                ).pipe(Effect.ignoreLogged);
                yield* Ref.update(pendingPermissions, HashMap.remove(localId));
              }
            }
            yield* database.session.delete(sessionId);
            yield* Effect.logInfo("Bot.service reset the session");
          }).pipe(Effect.annotateLogs("sessionId", sessionId));
          yield* Bot.sendChunks({
            client,
            chunks: yield* formatReset(),
            ignoreErrors: false,
            chatId,
            threadId,
          });
        }),
      );

      // --- Callback query handler for inline keyboard buttons ---
      client.on("callback_query:data", (ctx) =>
        Runtime.runPromise(runtime)(
          Effect.gen(function* () {
            if (ctx.from?.id !== userId) return;
            const data = ctx.callbackQuery.data;
            const parts = data.split(":");
            const prefix = parts[0];
            const localId = parts[1];
            if (!prefix || !localId) return;
            // Permission callbacks: p:{localId}:{reply} or pr:{localId}
            if (prefix === "p" || prefix === "pr") {
              const maybePp = HashMap.get(
                yield* Ref.get(pendingPermissions),
                localId,
              );
              if (Option.isNone(maybePp)) {
                yield* Effect.promise(() =>
                  ctx.answerCallbackQuery({
                    text: "The permission request has expired.",
                  }),
                ).pipe(Effect.ignoreLogged);
                return;
              }
              const pp = maybePp.value;
              const replyValue = prefix === "pr" ? "reject" : parts[2];
              if (
                replyValue !== "once" &&
                replyValue !== "always" &&
                replyValue !== "reject"
              ) {
                yield* Effect.promise(() => ctx.answerCallbackQuery()).pipe(
                  Effect.ignoreLogged,
                );
                return;
              }
              const reply = replyValue;
              yield* Ref.update(pendingPermissions, HashMap.remove(localId));
              yield* Effect.promise(() =>
                Promise.all([
                  opencode.client.permission.reply({
                    requestID: pp.request.id,
                    reply,
                  }),
                  client.api.editMessageText(
                    pp.chatId,
                    pp.interactionMessageId,
                    formatPermissionReplied(reply),
                  ),
                ]),
              ).pipe(
                Effect.tap(
                  Effect.logDebug("Bot.service replied to the permission"),
                ),
                Effect.ignoreLogged,
              );
              yield* Effect.promise(() => ctx.answerCallbackQuery()).pipe(
                Effect.ignoreLogged,
              );
              return;
            }
            // Question callbacks: q:{localId}:{index}, qc:{localId}, qr:{localId}
            const maybePq = HashMap.get(
              yield* Ref.get(pendingQuestions),
              localId,
            );
            if (Option.isNone(maybePq)) {
              yield* Effect.promise(() =>
                ctx.answerCallbackQuery({
                  text: "The question has expired.",
                }),
              ).pipe(Effect.ignoreLogged);
              return;
            }
            const pq = maybePq.value;
            const question = pq.questions[pq.currentIndex];
            invariant(question, "question");
            if (prefix === "q") {
              const optionIndex = Number(parts[2]);
              const option = question.options[optionIndex];
              invariant(option, "option");
              if (question.multiple) {
                // Toggle selection
                const newSelected = pq.selected.includes(option.label)
                  ? pq.selected.filter((s) => s !== option.label)
                  : [...pq.selected, option.label];
                const updated: Bot.PendingQuestion = {
                  ...pq,
                  selected: newSelected,
                };
                yield* Ref.update(
                  pendingQuestions,
                  HashMap.set(localId, updated),
                );
                // Rebuild keyboard with checkmarks
                const kb = buildQuestionKeyboard(
                  localId,
                  question,
                  newSelected,
                );
                yield* Effect.promise(() =>
                  ctx.editMessageReplyMarkup({ reply_markup: kb }),
                ).pipe(Effect.ignoreLogged);
              } else {
                // Single-select — answer immediately
                yield* advanceOrSubmit(localId, [option.label]);
              }
            } else if (prefix === "qc") {
              if (pq.selected.length === 0) {
                yield* Effect.promise(() =>
                  ctx.answerCallbackQuery({
                    text: "Select at least one option.",
                  }),
                ).pipe(Effect.ignoreLogged);
                return;
              }
              yield* advanceOrSubmit(localId, pq.selected);
            } else {
              invariant(prefix === "qr", `unknown callback prefix: ${prefix}`);
              yield* Ref.update(pendingQuestions, HashMap.remove(localId));
              yield* Effect.promise(() =>
                Promise.all([
                  opencode.client.question.reject({
                    requestID: pq.requestId,
                  }),
                  client.api.editMessageText(
                    pq.chatId,
                    pq.interactionMessageId,
                    formatQuestionRejected(),
                  ),
                ]),
              ).pipe(
                Effect.tap(
                  Effect.logDebug("Bot.service rejected the question"),
                ),
                Effect.ignoreLogged,
              );
            }
            yield* Effect.promise(() => ctx.answerCallbackQuery()).pipe(
              Effect.ignoreLogged,
            );
          }).pipe(
            Effect.annotateLogs("userId", ctx.from?.id),
            Effect.annotateLogs("chatId", ctx.chat?.id),
          ),
        ),
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
            // Check if there's a pending question for this chat
            const pendingQ = yield* findPendingByChat(
              ctx.chat.id,
              ctx.message?.message_thread_id,
            );
            if (Option.isSome(pendingQ)) {
              const pq = pendingQ.value;
              const question = pq.questions[pq.currentIndex];
              invariant(question, "question");
              if (question.custom === false) {
                // Cannot type custom answers — notify user
                yield* Bot.sendChunks({
                  client,
                  chunks: yield* formatQuestionPending(),
                  ignoreErrors: false,
                  chatId: ctx.chat.id,
                  threadId: ctx.message?.message_thread_id,
                });
                return;
              }
              // Use the text as a custom answer, including any selected options
              yield* advanceOrSubmit(pq.localId, [
                ...pq.selected,
                ctx.message.text,
              ]);
              return;
            }
            // Check if there's a pending permission for this chat
            const pendingP = yield* findPendingPermissionByChat(
              ctx.chat.id,
              ctx.message?.message_thread_id,
            );
            if (Option.isSome(pendingP)) {
              yield* Bot.sendChunks({
                client,
                chunks: yield* formatPermissionPending(),
                ignoreErrors: false,
                chatId: ctx.chat.id,
                threadId: ctx.message?.message_thread_id,
              });
              return;
            }
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
      yield* Effect.promise(() =>
        client.api.setMyCommands([
          { command: "start", description: "Say hi to your kitten 😺" },
          { command: "stop", description: "Shush the kitten mid-thought 🤫" },
          { command: "compact", description: "Groom the messy fur 🧶" },
          { command: "reset", description: "Fresh start, clean paws 🐾" },
        ]),
      );
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

  export interface PendingQuestion {
    readonly localId: string;
    readonly requestId: string;
    readonly sessionId: string;
    readonly chatId: number;
    readonly threadId: number | undefined;
    readonly questions: ReadonlyArray<QuestionInfo>;
    readonly currentIndex: number;
    readonly answers: ReadonlyArray<string[]>;
    readonly interactionMessageId: number;
    readonly selected: string[];
  }

  export interface PendingPermission {
    readonly localId: string;
    readonly request: PermissionRequest;
    readonly chatId: number;
    readonly threadId: number | undefined;
    readonly interactionMessageId: number;
  }
}
