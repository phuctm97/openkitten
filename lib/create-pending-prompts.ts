import type {
  PermissionRequest,
  QuestionInfo,
  QuestionRequest,
} from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { consola } from "consola";
import { type Bot, InlineKeyboard } from "grammy";
import invariant from "tiny-invariant";
import { grammyCheckGoneError } from "~/lib/grammy-check-gone-error";
import { grammyFormatPermissionMessage } from "~/lib/grammy-format-permission-message";
import { grammyFormatPermissionPrompt } from "~/lib/grammy-format-permission-prompt";
import { grammyFormatPermissionReplied } from "~/lib/grammy-format-permission-replied";
import { grammyFormatQuestionMessage } from "~/lib/grammy-format-question-message";
import { grammyFormatQuestionPrompt } from "~/lib/grammy-format-question-prompt";
import { grammyFormatQuestionRejected } from "~/lib/grammy-format-question-rejected";
import { grammyFormatQuestionReplied } from "~/lib/grammy-format-question-replied";
import { grammySendChunks } from "~/lib/grammy-send-chunks";
import { grammySendPermissionPending } from "~/lib/grammy-send-permission-pending";
import { grammySendQuestionPending } from "~/lib/grammy-send-question-pending";
import { opencodeCheckNotFoundError } from "~/lib/opencode-check-not-found-error";
import type { OpencodeSnapshot } from "~/lib/opencode-snapshot";
import { PendingPromptAnswerError } from "~/lib/pending-prompt-answer-error";
import type { PendingPromptAnswerOptions } from "~/lib/pending-prompt-answer-options";
import { PendingPromptNotFoundError } from "~/lib/pending-prompt-not-found-error";
import type { PendingPrompts } from "~/lib/pending-prompts";
import type { Session } from "~/lib/session";

interface PendingPromptQuestion {
  readonly kind: "question";
  readonly key: string;
  readonly request: QuestionRequest;
  messageId: number | undefined;
  currentIndex: number;
  currentAnswers: string[][];
  selectedOptions: string[];
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

  async function invalidate(
    { questions, permissions }: OpencodeSnapshot,
    ...sessionsArr: Session[]
  ) {
    if (sessionsArr.length === 0) return;
    const promises: Promise<void>[] = [];
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
          promises.push(grammyDismiss(session.id, chatId, item));
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
          currentAnswers: [],
          selectedOptions: [],
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
    await Promise.all(promises);
    // Auto-flush: send first unsent item to Telegram for each session
    const flushEntries: { sessionId: string; entry: SessionEntry }[] = [];
    const flushPromises: Promise<void>[] = [];
    for (const session of sessionsArr) {
      const entry = sessions.get(session.id);
      if (!entry) continue;
      if (entry.items.some((item) => item.messageId)) continue;
      const item = entry.items[0];
      invariant(item, "entry has items but first is undefined");
      flushEntries.push({ sessionId: session.id, entry });
      flushPromises.push(flushItem(session.id, entry, item));
    }
    const results = await Promise.allSettled(flushPromises);
    for (const [i, result] of results.entries()) {
      if (result.status === "rejected") {
        const flushEntry = flushEntries[i];
        invariant(flushEntry, "flush entry not found at index");
        const { sessionId, entry } = flushEntry;
        consola.error("Failed to flush pending prompt", {
          error: result.reason,
          sessionId,
          chatId: entry.chatId,
          threadId: entry.threadId,
        });
      }
    }
  }

  async function answer(options: PendingPromptAnswerOptions) {
    if ("text" in options) {
      await answerCustom(options.sessionId, options.text);
      return;
    }
    await answerCallback(
      options.sessionId,
      options.callbackQueryId,
      options.callbackQueryData,
    );
  }

  async function answerCustom(sessionId: string, text: string) {
    try {
      const entry = sessions.get(sessionId);
      if (!entry) throw new PendingPromptNotFoundError();
      const activeItem = entry.items.find((i) => i.messageId !== undefined);
      if (!activeItem) throw new PendingPromptNotFoundError();
      if (activeItem.kind === "permission") {
        await grammySendPermissionPending({
          bot,
          chatId: entry.chatId,
          threadId: entry.threadId,
          ignoreErrors: false,
        });
        return;
      }
      const question = activeItem.request.questions[activeItem.currentIndex];
      invariant(question, "question index out of bounds");
      if (question.custom === false) {
        await grammySendQuestionPending({
          bot,
          chatId: entry.chatId,
          threadId: entry.threadId,
          ignoreErrors: false,
        });
        return;
      }
      activeItem.selectedOptions = [...activeItem.selectedOptions, text];
      await advanceOrSubmit(sessionId, entry, activeItem);
    } catch (error) {
      if (grammyCheckGoneError(error)) {
        await dismiss(sessionId);
        return;
      }
      throw error;
    }
  }

  async function answerCallback(
    sessionId: string,
    callbackQueryId: string,
    callbackData: string,
  ) {
    try {
      const entry = sessions.get(sessionId);
      if (!entry) throw new PendingPromptAnswerError("expired_session");
      const parts = callbackData.split(":");
      const prefix = parts[0];
      const key = parts[1];
      if (!prefix || !key) throw new PendingPromptAnswerError("invalid_format");

      const found = findItemByKey(entry, key);
      if (!found) throw new PendingPromptAnswerError("expired_prompt");

      // Permission callbacks: po:{key}, pa:{key}, pr:{key}
      if (found.item.kind === "permission") {
        if (prefix !== "po" && prefix !== "pa" && prefix !== "pr")
          throw new PendingPromptAnswerError("invalid_prefix");
        const reply =
          prefix === "po" ? "once" : prefix === "pa" ? "always" : "reject";
        await answerReply(found.item, reply);
        await resolveItem(
          sessionId,
          entry,
          found.item,
          grammyFormatPermissionReplied(reply),
        );
        await grammyAnswerCallback(callbackQueryId);
        return;
      }

      // Question callbacks: qt:{key}:{index}, qc:{key}, qr:{key}
      if (prefix === "qr") {
        await answerReply(found.item, "reject");
        await resolveItem(
          sessionId,
          entry,
          found.item,
          grammyFormatQuestionRejected(),
        );
        await grammyAnswerCallback(callbackQueryId);
        return;
      }

      if (prefix === "qc") {
        await advanceOrSubmit(sessionId, entry, found.item);
        await grammyAnswerCallback(callbackQueryId);
        return;
      }

      if (prefix === "qt") {
        const selectStr = parts[2];
        if (!selectStr) throw new PendingPromptAnswerError("invalid_index");
        const select = Number.parseInt(selectStr, 10);
        if (Number.isNaN(select))
          throw new PendingPromptAnswerError("invalid_index");
        await answerSelect(sessionId, entry, found.item, select);
        await grammyAnswerCallback(callbackQueryId);
        return;
      }

      throw new PendingPromptAnswerError("unknown_prefix");
    } catch (error) {
      if (error instanceof PendingPromptAnswerError) {
        await grammyAnswerCallback(
          callbackQueryId,
          formatCallbackError(error.code),
        );
        return;
      }
      if (grammyCheckGoneError(error)) {
        await dismiss(sessionId);
        return;
      }
      await grammyAnswerCallback(callbackQueryId, formatCallbackError());
      throw error;
    }
  }

  async function dismiss(...sessionIds: string[]) {
    if (sessionIds.length === 0) return;
    const promises: Promise<void>[] = [];
    for (const sessionId of sessionIds) {
      const entry = sessions.get(sessionId);
      if (!entry) continue;
      for (const item of entry.items) {
        promises.push(opencodeDismiss(sessionId, entry.chatId, item));
        promises.push(grammyDismiss(sessionId, entry.chatId, item));
      }
      sessions.delete(sessionId);
    }
    await Promise.all(promises);
  }

  function nextKey() {
    return (keyCounter++).toString(36);
  }

  async function grammyEdit(
    chatId: number,
    messageId: number | undefined,
    text: string,
  ) {
    if (!messageId) return;
    await bot.api.editMessageText(chatId, messageId, text, {
      reply_markup: { inline_keyboard: [] },
    });
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

  async function flushItem(
    sessionId: string,
    entry: SessionEntry,
    item: PendingPromptItem,
  ) {
    try {
      const sendOpts = {
        ...(entry.threadId && { message_thread_id: entry.threadId }),
      };
      if (item.kind === "permission") {
        const chunks = grammyFormatPermissionMessage(item.request);
        await grammySendChunks({
          bot,
          chunks,
          chatId: entry.chatId,
          threadId: entry.threadId,
          ignoreErrors: false,
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
          chatId: entry.chatId,
          threadId: entry.threadId,
          ignoreErrors: false,
        });
        const promptText = grammyFormatQuestionPrompt(question);
        const kb = buildQuestionKeyboard(
          item.key,
          question,
          item.selectedOptions,
        );
        const sent = await bot.api.sendMessage(entry.chatId, promptText, {
          parse_mode: "MarkdownV2",
          reply_markup: kb,
          ...sendOpts,
        });
        item.messageId = sent.message_id;
      }
    } catch (error) {
      if (grammyCheckGoneError(error)) {
        await dismiss(sessionId);
        return;
      }
      throw error;
    }
  }

  function removeItem(sessionId: string, entry: SessionEntry, index: number) {
    entry.items.splice(index, 1);
    if (entry.items.length === 0) sessions.delete(sessionId);
  }

  async function resolveItem(
    sessionId: string,
    entry: SessionEntry,
    item: PendingPromptItem,
    resolvedText: string,
  ) {
    await grammyEdit(entry.chatId, item.messageId, resolvedText);
    const itemIndex = entry.items.indexOf(item);
    invariant(itemIndex !== -1, "resolved item not found in session");
    removeItem(sessionId, entry, itemIndex);
    if (entry.items.length > 0) {
      const nextItem = entry.items.find((i) => !i.messageId);
      invariant(nextItem, "remaining items all have messageId");
      await flushItem(sessionId, entry, nextItem);
    }
  }

  async function advanceOrSubmit(
    sessionId: string,
    entry: SessionEntry,
    item: PendingPromptQuestion,
  ) {
    const currentAnswer = item.selectedOptions;
    const newAnswers = [...item.currentAnswers, currentAnswer];
    const nextIndex = item.currentIndex + 1;
    if (nextIndex < item.request.questions.length) {
      await grammyEdit(
        entry.chatId,
        item.messageId,
        grammyFormatQuestionReplied(currentAnswer),
      );
      item.currentIndex = nextIndex;
      item.currentAnswers = newAnswers;
      item.selectedOptions = [];
      item.messageId = undefined;
      await flushItem(sessionId, entry, item);
    } else {
      await opencodeClient.question.reply(
        { requestID: item.request.id, answers: newAnswers },
        { throwOnError: true },
      );
      await resolveItem(
        sessionId,
        entry,
        item,
        grammyFormatQuestionReplied(currentAnswer),
      );
    }
  }

  function findItemByKey(entry: SessionEntry, key: string) {
    const itemIndex = entry.items.findIndex((i) => i.key === key);
    if (itemIndex === -1) return undefined;
    const item = entry.items[itemIndex];
    invariant(item, "item not found at index");
    return { item, itemIndex };
  }

  async function answerReply(
    item: PendingPromptItem,
    reply: "once" | "always" | "reject",
  ) {
    if (item.kind === "permission") {
      await opencodeClient.permission.reply(
        { requestID: item.request.id, reply },
        { throwOnError: true },
      );
    } else {
      await opencodeClient.question.reject(
        { requestID: item.request.id },
        { throwOnError: true },
      );
    }
  }

  function formatCallbackError(code?: string) {
    const base = "An error occurred";
    return code ? `${base}: ${code}` : base;
  }

  async function grammyAnswerCallback(callbackQueryId: string, text?: string) {
    await bot.api.answerCallbackQuery(
      callbackQueryId,
      text ? { text } : undefined,
    );
  }

  async function answerSelect(
    sessionId: string,
    entry: SessionEntry,
    item: PendingPromptQuestion,
    select: number,
  ) {
    const question = item.request.questions[item.currentIndex];
    invariant(question, "question index out of bounds");
    const option = question.options.at(select);
    if (!option) throw new PendingPromptAnswerError("invalid_option");
    if (item.selectedOptions.includes(option.label)) {
      item.selectedOptions = item.selectedOptions.filter(
        (s) => s !== option.label,
      );
    } else if (question.multiple) {
      item.selectedOptions = [...item.selectedOptions, option.label];
    } else {
      item.selectedOptions = [option.label];
    }
    if (!question.multiple) {
      await advanceOrSubmit(sessionId, entry, item);
    } else if (item.messageId) {
      const promptText = grammyFormatQuestionPrompt(question);
      const kb = buildQuestionKeyboard(
        item.key,
        question,
        item.selectedOptions,
      );
      await bot.api.editMessageText(entry.chatId, item.messageId, promptText, {
        parse_mode: "MarkdownV2",
        reply_markup: kb,
      });
    }
  }

  async function opencodeDismiss(
    sessionId: string,
    chatId: number,
    item: PendingPromptItem,
  ) {
    try {
      if (item.kind === "question") {
        await opencodeClient.question.reject(
          { requestID: item.request.id },
          { throwOnError: true },
        );
      } else {
        await opencodeClient.permission.reply(
          { requestID: item.request.id, reply: "reject" },
          { throwOnError: true },
        );
      }
    } catch (error) {
      if (!opencodeCheckNotFoundError(error)) {
        consola.warn("Failed to dismiss pending prompt in OpenCode", {
          error,
          kind: item.kind,
          sessionId,
          chatId,
          requestId: item.request.id,
        });
      }
    }
  }

  async function grammyDismiss(
    sessionId: string,
    chatId: number,
    item: PendingPromptItem,
  ) {
    try {
      const text =
        item.kind === "question"
          ? grammyFormatQuestionRejected()
          : grammyFormatPermissionReplied("reject");
      await grammyEdit(chatId, item.messageId, text);
    } catch (error) {
      if (!grammyCheckGoneError(error)) {
        consola.warn("Failed to dismiss pending prompt in Telegram", {
          error,
          kind: item.kind,
          sessionId,
          chatId,
          messageId: item.messageId,
        });
      }
    }
  }

  return {
    get sessionIds() {
      return [...sessions.keys()];
    },
    invalidate,
    answer,
    dismiss,
    async [Symbol.asyncDispose]() {
      await dismiss(...sessions.keys());
    },
  };
}
