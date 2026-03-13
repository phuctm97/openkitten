import type {
  PermissionRequest,
  QuestionInfo,
  QuestionRequest,
} from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";
import { type Bot, InlineKeyboard } from "grammy";
import invariant from "tiny-invariant";
import { grammyCheckAccessError } from "~/lib/grammy-check-access-error";
import { grammyFormatPermissionMessage } from "~/lib/grammy-format-permission-message";
import { grammyFormatPermissionPrompt } from "~/lib/grammy-format-permission-prompt";
import { grammyFormatPermissionReplied } from "~/lib/grammy-format-permission-replied";
import { grammyFormatQuestionMessage } from "~/lib/grammy-format-question-message";
import { grammyFormatQuestionPrompt } from "~/lib/grammy-format-question-prompt";
import { grammyFormatQuestionRejected } from "~/lib/grammy-format-question-rejected";
import { grammyFormatQuestionReplied } from "~/lib/grammy-format-question-replied";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import type { PendingPromptAnswerOptions } from "~/lib/pending-prompt-answer-options";
import type { PendingPromptResult } from "~/lib/pending-prompt-result";
import type { PendingPrompts } from "~/lib/pending-prompts";
import type { Session } from "~/lib/session";

interface PendingPromptQuestion {
  readonly kind: "question";
  readonly key: string;
  readonly request: QuestionRequest;
  messageId: number | undefined;
  currentIndex: number;
  answers: string[][];
  selected: string[];
}

interface PendingPromptPermission {
  readonly kind: "permission";
  readonly key: string;
  readonly request: PermissionRequest;
  messageId: number | undefined;
}

type PendingPromptItem = PendingPromptQuestion | PendingPromptPermission;

interface SessionEntry {
  readonly chatId: number;
  readonly threadId: number | undefined;
  items: PendingPromptItem[];
}

export function createPendingPrompts(
  bot: Bot,
  opencodeClient: OpencodeClient,
): PendingPrompts {
  const sessions = new Map<string, SessionEntry>();
  let keyCounter = 0;

  function nextKey() {
    return (keyCounter++).toString(36);
  }

  function grammyEdit(
    chatId: number,
    messageId: number | undefined,
    text: string,
  ) {
    if (messageId === undefined) return;
    bot.api
      .editMessageText(chatId, messageId, text, {
        reply_markup: { inline_keyboard: [] },
      })
      .catch((error: unknown) => {
        if (!grammyCheckAccessError(error)) {
          consola.warn(
            "pending prompt grammy edit failed",
            { chatId, messageId },
            error,
          );
        }
      });
  }

  function opencodeDismiss(sessionId: string, item: PendingPromptItem) {
    if (item.kind === "question") {
      opencodeClient.question
        .reject({ requestID: item.request.id })
        .catch((error: unknown) => {
          consola.warn(
            "pending prompt opencode dismiss question failed",
            { sessionId, requestID: item.request.id },
            error,
          );
        });
    } else {
      opencodeClient.permission
        .reply({ requestID: item.request.id, reply: "reject" })
        .catch((error: unknown) => {
          consola.warn(
            "pending prompt opencode dismiss permission failed",
            { sessionId, requestID: item.request.id },
            error,
          );
        });
    }
  }

  function buildQuestionKeyboard(
    key: string,
    question: QuestionInfo,
    selected: readonly string[],
  ) {
    const kb = new InlineKeyboard();
    for (const [i, opt] of question.options.entries()) {
      const isSelected = selected.includes(opt.label);
      const label = isSelected ? `✓ ${opt.label}` : opt.label;
      kb.text(label, `qt:${key}:${i}`);
      if (i % 2 === 1) kb.row();
    }
    if (question.options.length % 2 === 1) kb.row();
    if (question.multiple) kb.text("Confirm", `qc:${key}`).row();
    kb.text("Dismiss", `qr:${key}`);
    return kb;
  }

  function buildPermissionKeyboard(key: string) {
    return new InlineKeyboard()
      .text("Allow (once)", `po:${key}`)
      .text("Allow (always)", `pa:${key}`)
      .row()
      .text("Deny", `pr:${key}`);
  }

  async function flushItem(entry: SessionEntry, item: PendingPromptItem) {
    const sendOpts = {
      ...(entry.threadId && { message_thread_id: entry.threadId }),
    };
    if (item.kind === "permission") {
      const chunks = grammyFormatPermissionMessage(item.request);
      await grammySendChunks({
        bot,
        chunks,
        ignoreErrors: false,
        chatId: entry.chatId,
        threadId: entry.threadId,
      });
      const promptText = grammyFormatPermissionPrompt();
      const kb = buildPermissionKeyboard(item.key);
      const sent = await bot.api.sendMessage(entry.chatId, promptText, {
        parse_mode: "MarkdownV2",
        reply_markup: kb,
        ...sendOpts,
      });
      item.messageId = sent.message_id;
    } else {
      const question = item.request.questions[item.currentIndex];
      invariant(question, "question index out of bounds");
      const chunks = grammyFormatQuestionMessage(question);
      await grammySendChunks({
        bot,
        chunks,
        ignoreErrors: false,
        chatId: entry.chatId,
        threadId: entry.threadId,
      });
      const promptText = grammyFormatQuestionPrompt(question);
      const kb = buildQuestionKeyboard(item.key, question, item.selected);
      const sent = await bot.api.sendMessage(entry.chatId, promptText, {
        parse_mode: "MarkdownV2",
        reply_markup: kb,
        ...sendOpts,
      });
      item.messageId = sent.message_id;
    }
  }

  function removeItem(sessionId: string, entry: SessionEntry, index: number) {
    entry.items.splice(index, 1);
    if (entry.items.length === 0) sessions.delete(sessionId);
  }

  async function advanceOrSubmit(
    sessionId: string,
    entry: SessionEntry,
    item: PendingPromptQuestion,
  ) {
    const currentAnswer = item.selected;
    const newAnswers = [...item.answers, currentAnswer];
    const nextIndex = item.currentIndex + 1;
    if (nextIndex < item.request.questions.length) {
      grammyEdit(
        entry.chatId,
        item.messageId,
        grammyFormatQuestionReplied(currentAnswer),
      );
      item.currentIndex = nextIndex;
      item.answers = newAnswers;
      item.selected = [];
      item.messageId = undefined;
      await flushItem(entry, item);
    } else {
      opencodeClient.question
        .reply({ requestID: item.request.id, answers: newAnswers })
        .catch((error: unknown) => {
          consola.warn(
            "pending prompt opencode question reply failed",
            { sessionId, requestID: item.request.id },
            error,
          );
        });
    }
  }

  function dismiss(...sessionIds: string[]) {
    for (const sessionId of sessionIds) {
      const entry = sessions.get(sessionId);
      if (!entry) continue;
      for (const item of entry.items) {
        opencodeDismiss(sessionId, item);
        const text =
          item.kind === "question"
            ? grammyFormatQuestionRejected()
            : grammyFormatPermissionReplied("reject");
        grammyEdit(entry.chatId, item.messageId, text);
      }
      sessions.delete(sessionId);
      consola.debug("pending prompts dismissed", { sessionId });
    }
  }

  async function invalidate(...sessionsArr: Session[]) {
    const [questionResult, permissionResult] = await Promise.all([
      opencodeClient.question.list({}),
      opencodeClient.permission.list({}),
    ]);
    if (questionResult.error) throw questionResult.error;
    if (permissionResult.error) throw permissionResult.error;
    const questions = questionResult.data ?? [];
    const permissions = permissionResult.data ?? [];
    for (const session of sessionsArr) {
      const serverQuestionIds = new Set(
        questions.filter((q) => q.sessionID === session.id).map((q) => q.id),
      );
      const serverPermissionIds = new Set(
        permissions.filter((p) => p.sessionID === session.id).map((p) => p.id),
      );
      const existing = sessions.get(session.id);
      const existingItems = existing?.items ?? [];
      const chatId = session.chatId;
      const threadId = session.threadId || undefined;
      // Dismiss stale items on Telegram (in local but no longer on server)
      for (const item of existingItems) {
        const serverIds =
          item.kind === "question" ? serverQuestionIds : serverPermissionIds;
        if (!serverIds.has(item.request.id)) {
          const text =
            item.kind === "question"
              ? grammyFormatQuestionRejected()
              : grammyFormatPermissionReplied("reject");
          grammyEdit(chatId, item.messageId, text);
        }
      }
      // Keep items still on server
      const keptItems = existingItems.filter((item) => {
        const serverIds =
          item.kind === "question" ? serverQuestionIds : serverPermissionIds;
        return serverIds.has(item.request.id);
      });
      // Add new items from server
      const existingRequestIds = new Set(
        existingItems.map((i) => i.request.id),
      );
      const newQuestionItems: PendingPromptItem[] = questions
        .filter(
          (q) => q.sessionID === session.id && !existingRequestIds.has(q.id),
        )
        .map((q) => ({
          kind: "question" as const,
          key: nextKey(),
          request: q,
          messageId: undefined,
          currentIndex: 0,
          answers: [],
          selected: [],
        }));
      const newPermissionItems: PendingPromptItem[] = permissions
        .filter(
          (p) => p.sessionID === session.id && !existingRequestIds.has(p.id),
        )
        .map((p) => ({
          kind: "permission" as const,
          key: nextKey(),
          request: p,
          messageId: undefined,
        }));
      const allItems = [
        ...keptItems,
        ...newQuestionItems,
        ...newPermissionItems,
      ];
      if (allItems.length > 0) {
        sessions.set(session.id, { chatId, threadId, items: allItems });
      } else {
        sessions.delete(session.id);
      }
    }
  }

  async function flush() {
    // Only one prompt at a time — if any item has a messageId, it's active
    for (const entry of sessions.values()) {
      if (entry.items.some((item) => item.messageId !== undefined)) return;
    }
    // Send the first item of the first session
    const entry = sessions.values().next().value;
    if (!entry) return;
    const item = entry.items[0];
    invariant(item, "entry has no items");
    await flushItem(entry, item);
  }

  function findItemByKey(entry: SessionEntry, key: string) {
    const itemIndex = entry.items.findIndex((i) => i.key === key);
    if (itemIndex === -1) return undefined;
    const item = entry.items[itemIndex];
    invariant(item, "item not found at index");
    return { item, itemIndex };
  }

  function answerReply(
    sessionId: string,
    item: PendingPromptItem,
    reply: "once" | "always" | "reject",
  ) {
    if (item.kind === "permission") {
      opencodeClient.permission
        .reply({ requestID: item.request.id, reply })
        .catch((error: unknown) => {
          consola.warn(
            "pending prompt opencode permission reply failed",
            { sessionId, requestID: item.request.id },
            error,
          );
        });
    } else {
      opencodeClient.question
        .reject({ requestID: item.request.id })
        .catch((error: unknown) => {
          consola.warn(
            "pending prompt opencode question reject failed",
            { sessionId, requestID: item.request.id },
            error,
          );
        });
    }
  }

  function formatCallbackError(code: string) {
    return `An error occurred: ${code}`;
  }

  function grammyAnswerCallback(callbackId: string, text?: string) {
    bot.api
      .answerCallbackQuery(callbackId, text ? { text } : undefined)
      .catch((error: unknown) => {
        if (!grammyCheckAccessError(error)) {
          consola.warn(
            "pending prompt grammy answer callback failed",
            { callbackId },
            error,
          );
        }
      });
  }

  async function answerSelect(
    sessionId: string,
    entry: SessionEntry,
    item: PendingPromptQuestion,
    select: number,
    callbackId: string,
  ) {
    const question = item.request.questions[item.currentIndex];
    invariant(question, "question index out of bounds");
    const option = question.options.at(select);
    if (!option) {
      grammyAnswerCallback(callbackId, formatCallbackError("invalid_option"));
      return;
    }
    if (item.selected.includes(option.label)) {
      item.selected = item.selected.filter((s) => s !== option.label);
    } else if (question.multiple) {
      item.selected = [...item.selected, option.label];
    } else {
      item.selected = [option.label];
    }
    if (!question.multiple) {
      await advanceOrSubmit(sessionId, entry, item);
    } else if (item.messageId !== undefined) {
      const promptText = grammyFormatQuestionPrompt(question);
      const kb = buildQuestionKeyboard(item.key, question, item.selected);
      bot.api
        .editMessageText(entry.chatId, item.messageId, promptText, {
          parse_mode: "MarkdownV2",
          reply_markup: kb,
        })
        .catch((error: unknown) => {
          if (!grammyCheckAccessError(error)) {
            consola.warn(
              "pending prompt grammy select failed",
              { chatId: entry.chatId, messageId: item.messageId },
              error,
            );
          }
        });
    }
    grammyAnswerCallback(callbackId);
  }

  async function answer({
    sessionId,
    callbackQueryId: callbackId,
    callbackQueryData: callbackData,
  }: PendingPromptAnswerOptions) {
    const entry = sessions.get(sessionId);
    if (!entry) {
      grammyAnswerCallback(callbackId, formatCallbackError("expired_session"));
      return;
    }
    const parts = callbackData.split(":");
    const prefix = parts[0];
    const key = parts[1];
    if (!prefix || !key) {
      grammyAnswerCallback(callbackId, formatCallbackError("invalid_format"));
      return;
    }

    const found = findItemByKey(entry, key);
    if (!found) {
      grammyAnswerCallback(callbackId, formatCallbackError("expired_prompt"));
      return;
    }

    // Permission callbacks: po:{key}, pa:{key}, pr:{key}
    if (found.item.kind === "permission") {
      if (prefix !== "po" && prefix !== "pa" && prefix !== "pr") {
        grammyAnswerCallback(callbackId, formatCallbackError("invalid_prefix"));
        return;
      }
      const reply =
        prefix === "po" ? "once" : prefix === "pa" ? "always" : "reject";
      answerReply(sessionId, found.item, reply);
      grammyAnswerCallback(callbackId);
      return;
    }

    // Question callbacks: qt:{key}:{index}, qc:{key}, qr:{key}
    if (prefix === "qr") {
      answerReply(sessionId, found.item, "reject");
      grammyAnswerCallback(callbackId);
      return;
    }

    if (prefix === "qc") {
      await advanceOrSubmit(sessionId, entry, found.item);
      grammyAnswerCallback(callbackId);
      return;
    }

    if (prefix === "qt") {
      const selectStr = parts[2];
      if (!selectStr) {
        grammyAnswerCallback(callbackId, formatCallbackError("invalid_index"));
        return;
      }
      const select = Number.parseInt(selectStr, 10);
      if (Number.isNaN(select)) {
        grammyAnswerCallback(callbackId, formatCallbackError("invalid_index"));
        return;
      }
      await answerSelect(sessionId, entry, found.item, select, callbackId);
      return;
    }

    grammyAnswerCallback(callbackId, formatCallbackError("unknown_prefix"));
  }

  function resolve(sessionId: string, promptResult: PendingPromptResult) {
    const entry = sessions.get(sessionId);
    if (!entry) return;
    const itemIndex = entry.items.findIndex(
      (i) => i.request.id === promptResult.requestId,
    );
    if (itemIndex === -1) return;
    const item = entry.items[itemIndex];
    invariant(item, "item not found at index");
    if (promptResult.kind === "question-replied") {
      if (item.kind !== "question") return;
      grammyEdit(
        entry.chatId,
        item.messageId,
        grammyFormatQuestionReplied(item.selected),
      );
    } else if (promptResult.kind === "question-rejected") {
      if (item.kind !== "question") return;
      grammyEdit(entry.chatId, item.messageId, grammyFormatQuestionRejected());
    } else {
      if (item.kind !== "permission") return;
      grammyEdit(
        entry.chatId,
        item.messageId,
        grammyFormatPermissionReplied(promptResult.reply),
      );
    }
    removeItem(sessionId, entry, itemIndex);
  }

  return {
    get sessionIds() {
      return [...sessions.keys()];
    },
    invalidate,
    flush,
    answer,
    resolve,
    dismiss,
    [Symbol.dispose]() {
      dismiss(...sessions.keys());
    },
  };
}
