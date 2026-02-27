import type {
  EventPermissionAsked,
  EventQuestionAsked,
  PermissionRequest,
  QuestionInfo,
  QuestionRequest,
} from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { type Bot, InlineKeyboard } from "grammy";
import { createHooks, type Hookable } from "hookable";
import invariant from "tiny-invariant";
import { Errors } from "~/lib/errors";
import type { ExistingSessions } from "~/lib/existing-sessions";
import { grammyFormatPermissionPrompt } from "~/lib/grammy-format-permission-prompt";
import { grammyFormatPermissionReplied } from "~/lib/grammy-format-permission-replied";
import { grammyFormatQuestionPrompt } from "~/lib/grammy-format-question-prompt";
import { grammyFormatQuestionRejected } from "~/lib/grammy-format-question-rejected";
import { grammyFormatQuestionReplied } from "~/lib/grammy-format-question-replied";
import { grammySendPermissionMessage } from "~/lib/grammy-send-permission-message";
import { grammySendPermissionPending } from "~/lib/grammy-send-permission-pending";
import { grammySendQuestionMessage } from "~/lib/grammy-send-question-message";
import { grammySendQuestionPending } from "~/lib/grammy-send-question-pending";
import { logger } from "~/lib/logger";
import type { Shutdown } from "~/lib/shutdown";

export class PendingPrompts implements AsyncDisposable {
  readonly #shutdown: Shutdown;
  readonly #bot: Bot;
  readonly #opencodeClient: OpencodeClient;
  readonly #existingSessions: ExistingSessions;
  readonly #hooks = createHooks<PendingPrompts.Hooks>();
  readonly #sessionMap = new Map<string, PendingPrompts.Item[]>();
  readonly #unhook: () => void;
  #keyCounter = 0;

  private constructor(
    shutdown: Shutdown,
    bot: Bot,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ) {
    this.#shutdown = shutdown;
    this.#bot = bot;
    this.#opencodeClient = opencodeClient;
    this.#existingSessions = existingSessions;
    this.#unhook = existingSessions.hook(
      "beforeRemove",
      async ({ sessionId }) => {
        await this.#dismiss(sessionId);
      },
    );
  }

  #nextKey() {
    return (this.#keyCounter++).toString(36);
  }

  #buildQuestionKeyboard(
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

  #buildPermissionKeyboard(key: string) {
    return new InlineKeyboard()
      .text("Allow (once)", `po:${key}`)
      .text("Allow (always)", `pa:${key}`)
      .row()
      .text("Deny", `pr:${key}`);
  }

  async #flushItem(item: PendingPrompts.Item) {
    const { chatId, threadId } = this.#existingSessions.resolve(
      item.request.sessionID,
    );
    const sendOpts = {
      ...(threadId && { message_thread_id: threadId }),
    };
    if (item.kind === "permission") {
      await grammySendPermissionMessage({
        bot: this.#bot,
        request: item.request,
        chatId,
        threadId,
      });
      const promptText = grammyFormatPermissionPrompt();
      const kb = this.#buildPermissionKeyboard(item.key);
      const sent = await this.#bot.api.sendMessage(chatId, promptText, {
        parse_mode: "MarkdownV2",
        reply_markup: kb,
        ...sendOpts,
      });
      item.messageId = sent.message_id;
    } else {
      const question = item.request.questions[item.currentIndex];
      invariant(question, "Expected a question at the current index");
      await grammySendQuestionMessage({
        bot: this.#bot,
        question,
        chatId,
        threadId,
      });
      const promptText = grammyFormatQuestionPrompt(question);
      const kb = this.#buildQuestionKeyboard(
        item.key,
        question,
        item.selectedOptions,
      );
      const sent = await this.#bot.api.sendMessage(chatId, promptText, {
        parse_mode: "MarkdownV2",
        reply_markup: kb,
        ...sendOpts,
      });
      item.messageId = sent.message_id;
    }
  }

  #removeItem(items: PendingPrompts.Item[], item: PendingPrompts.Item) {
    const index = items.indexOf(item);
    invariant(
      index !== -1,
      "Expected the resolved item to exist in session items",
    );
    items.splice(index, 1);
    if (items.length === 0) this.#sessionMap.delete(item.request.sessionID);
  }

  async #resolveItem(
    items: PendingPrompts.Item[],
    item: PendingPrompts.Item,
    resolvedText: string,
  ) {
    this.#removeItem(items, item);
    const { chatId } = this.#existingSessions.resolve(item.request.sessionID);
    invariant(
      item.messageId,
      "Expected item to have a messageId when resolving",
    );
    await this.#bot.api.editMessageText(chatId, item.messageId, resolvedText, {
      reply_markup: { inline_keyboard: [] },
    });
    if (items.length > 0) {
      const nextItem = items.find((i) => !i.messageId);
      invariant(
        nextItem,
        "Expected an unflushed item but all items have messageId",
      );
      await this.#flushItem(nextItem);
    } else {
      const results = await this.#hooks.callHookWith(
        (hooks, args) => Promise.allSettled(hooks.map((hook) => hook(...args))),
        "change",
        [{ sessionId: item.request.sessionID, pending: false }],
      );
      Errors.throwIfAny(results);
    }
  }

  async #advanceOrSubmit(
    items: PendingPrompts.Item[],
    item: PendingPrompts.Question,
  ) {
    const currentAnswer = item.selectedOptions;
    const newAnswers = [...item.currentAnswers, currentAnswer];
    const nextIndex = item.currentIndex + 1;
    if (nextIndex < item.request.questions.length) {
      const previousMessageId = item.messageId;
      item.currentIndex = nextIndex;
      item.currentAnswers = newAnswers;
      item.selectedOptions = [];
      item.messageId = undefined;
      const { chatId } = this.#existingSessions.resolve(item.request.sessionID);
      invariant(
        previousMessageId,
        "Expected item to have a messageId when advancing",
      );
      await this.#bot.api.editMessageText(
        chatId,
        previousMessageId,
        grammyFormatQuestionReplied(currentAnswer),
        { reply_markup: { inline_keyboard: [] } },
      );
      await this.#flushItem(item);
    } else {
      await this.#opencodeClient.question.reply(
        { requestID: item.request.id, answers: newAnswers },
        { throwOnError: true },
      );
      await this.#resolveItem(
        items,
        item,
        grammyFormatQuestionReplied(currentAnswer),
      );
    }
  }

  async #answerReply(
    item: PendingPrompts.Item,
    reply: "once" | "always" | "reject",
  ) {
    if (item.kind === "permission") {
      await this.#opencodeClient.permission.reply(
        { requestID: item.request.id, reply },
        { throwOnError: true },
      );
    } else {
      await this.#opencodeClient.question.reject(
        { requestID: item.request.id },
        { throwOnError: true },
      );
    }
  }

  async #answerSelect(
    items: PendingPrompts.Item[],
    item: PendingPrompts.Question,
    select: number,
  ) {
    const question = item.request.questions[item.currentIndex];
    invariant(question, "Expected a question at the current index");
    const option = question.options.at(select);
    if (!option) throw new PendingPrompts.AnswerError("invalid_option");
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
      await this.#advanceOrSubmit(items, item);
    } else if (item.messageId) {
      const { chatId } = this.#existingSessions.resolve(item.request.sessionID);
      const promptText = grammyFormatQuestionPrompt(question);
      const kb = this.#buildQuestionKeyboard(
        item.key,
        question,
        item.selectedOptions,
      );
      await this.#bot.api.editMessageText(chatId, item.messageId, promptText, {
        parse_mode: "MarkdownV2",
        reply_markup: kb,
      });
    }
  }

  async #opencodeDismiss(item: PendingPrompts.Item) {
    if (item.kind === "question") {
      await this.#opencodeClient.question.reject(
        { requestID: item.request.id },
        { throwOnError: true },
      );
    } else {
      await this.#opencodeClient.permission.reply(
        { requestID: item.request.id, reply: "reject" },
        { throwOnError: true },
      );
    }
  }

  async #grammyDismiss(item: PendingPrompts.Item) {
    if (!item.messageId) return;
    const { chatId } = this.#existingSessions.resolve(item.request.sessionID);
    const text =
      item.kind === "question"
        ? grammyFormatQuestionRejected()
        : grammyFormatPermissionReplied("reject");
    await this.#bot.api.editMessageText(chatId, item.messageId, text, {
      reply_markup: { inline_keyboard: [] },
    });
  }

  async #answerCustom(sessionId: string, text: string) {
    const items = this.#sessionMap.get(sessionId);
    if (!items) throw new PendingPrompts.NotFoundError();
    const activeItem = items.find((i) => i.messageId);
    if (!activeItem) throw new PendingPrompts.NotFoundError();
    if (activeItem.kind === "permission") {
      const { chatId, threadId } = this.#existingSessions.resolve(sessionId);
      await grammySendPermissionPending({
        bot: this.#bot,
        chatId,
        threadId,
      });
      return;
    }
    const question = activeItem.request.questions[activeItem.currentIndex];
    invariant(question, "Expected a question at the current index");
    if (question.custom === false) {
      const { chatId, threadId } = this.#existingSessions.resolve(sessionId);
      await grammySendQuestionPending({
        bot: this.#bot,
        chatId,
        threadId,
      });
      return;
    }
    activeItem.selectedOptions = [...activeItem.selectedOptions, text];
    await this.#advanceOrSubmit(items, activeItem);
  }

  async #answerCallback(
    sessionId: string,
    callbackQueryId: string,
    callbackData: string,
  ) {
    try {
      const items = this.#sessionMap.get(sessionId);
      if (!items) throw new PendingPrompts.AnswerError("expired_session");
      const parts = callbackData.split(":");
      const prefix = parts[0];
      const key = parts[1];
      if (!prefix || !key)
        throw new PendingPrompts.AnswerError("invalid_format");

      const item = items.find((i) => i.key === key);
      if (!item) throw new PendingPrompts.AnswerError("expired_prompt");

      // Permission callbacks: po:{key}, pa:{key}, pr:{key}
      if (item.kind === "permission") {
        if (prefix !== "po" && prefix !== "pa" && prefix !== "pr")
          throw new PendingPrompts.AnswerError("invalid_prefix");
        const reply =
          prefix === "po" ? "once" : prefix === "pa" ? "always" : "reject";
        await this.#answerReply(item, reply);
        await this.#resolveItem(
          items,
          item,
          grammyFormatPermissionReplied(reply),
        );
        await this.#bot.api.answerCallbackQuery(callbackQueryId);
        return;
      }

      // Question callbacks: qt:{key}:{index}, qc:{key}, qr:{key}
      if (prefix === "qr") {
        await this.#answerReply(item, "reject");
        await this.#resolveItem(items, item, grammyFormatQuestionRejected());
        await this.#bot.api.answerCallbackQuery(callbackQueryId);
        return;
      }

      if (prefix === "qc") {
        await this.#advanceOrSubmit(items, item);
        await this.#bot.api.answerCallbackQuery(callbackQueryId);
        return;
      }

      if (prefix === "qt") {
        const selectStr = parts[2];
        if (!selectStr) throw new PendingPrompts.AnswerError("invalid_index");
        const select = Number.parseInt(selectStr, 10);
        if (Number.isNaN(select))
          throw new PendingPrompts.AnswerError("invalid_index");
        await this.#answerSelect(items, item, select);
        await this.#bot.api.answerCallbackQuery(callbackQueryId);
        return;
      }

      throw new PendingPrompts.AnswerError("unknown_prefix");
    } catch (error) {
      // Expected user errors — send feedback via callback and return
      if (error instanceof PendingPrompts.AnswerError) {
        await this.#bot.api.answerCallbackQuery(callbackQueryId, {
          text: `An error occurred: ${error.code}`,
        });
        return;
      }
      throw error;
    }
  }

  async #dismiss(sessionId: string) {
    const items = this.#sessionMap.get(sessionId);
    if (!items) return;
    const promises: Promise<void>[] = [];
    for (const item of items) {
      promises.push(this.#opencodeDismiss(item));
      promises.push(this.#grammyDismiss(item));
    }
    this.#sessionMap.delete(sessionId);
    const dismissResults = await Promise.allSettled(promises);
    const hookResults = await this.#hooks.callHookWith(
      (hooks, args) => Promise.allSettled(hooks.map((hook) => hook(...args))),
      "change",
      [{ sessionId, pending: false }],
    );
    Errors.throwIfAny([...dismissResults, ...hookResults]);
  }

  readonly hook: Hookable<PendingPrompts.Hooks>["hook"] = (...args) =>
    this.#hooks.hook(...args);

  check(sessionId: string): boolean {
    return this.#sessionMap.has(sessionId);
  }

  async answer(options: PendingPrompts.AnswerOptions) {
    if ("text" in options) {
      await this.#answerCustom(options.sessionId, options.text);
      return;
    }
    await this.#answerCallback(
      options.sessionId,
      options.callbackQueryId,
      options.callbackQueryData,
    );
  }

  async update(event: EventQuestionAsked | EventPermissionAsked) {
    const sessionId = event.properties.sessionID;
    let items = this.#sessionMap.get(sessionId);
    if (items?.some((i) => i.request.id === event.properties.id)) return;
    const wasPending = !!items;
    if (!items) {
      items = [];
      this.#sessionMap.set(sessionId, items);
    }
    const item: PendingPrompts.Item =
      event.type === "question.asked"
        ? {
            kind: "question",
            key: this.#nextKey(),
            request: event.properties,
            messageId: undefined,
            currentIndex: 0,
            currentAnswers: [],
            selectedOptions: [],
          }
        : {
            kind: "permission",
            key: this.#nextKey(),
            request: event.properties,
            messageId: undefined,
          };
    items.push(item);
    // Show one prompt at a time per session — only flush if nothing is displayed.
    if (!items.some((i) => i.messageId)) {
      const first = items[0];
      invariant(first, "Expected at least one item in non-empty session");
      await this.#flushItem(first);
    }
    if (!wasPending) {
      const results = await this.#hooks.callHookWith(
        (hooks, args) => Promise.allSettled(hooks.map((hook) => hook(...args))),
        "change",
        [{ sessionId, pending: true }],
      );
      Errors.throwIfAny(results);
    }
  }

  async invalidate(
    questions: readonly QuestionRequest[],
    permissions: readonly PermissionRequest[],
  ) {
    const { sessionIds } = this.#existingSessions;
    if (sessionIds.length === 0) return;
    const dismissPromises: Promise<void>[] = [];
    const changedSessions: PendingPrompts.ChangeEvent[] = [];
    for (const sessionId of sessionIds) {
      const wasPending = this.#sessionMap.has(sessionId);
      const serverQuestionIds = new Set(
        questions.filter((q) => q.sessionID === sessionId).map((q) => q.id),
      );
      const serverPermissionIds = new Set(
        permissions.filter((p) => p.sessionID === sessionId).map((p) => p.id),
      );
      const existing = this.#sessionMap.get(sessionId);
      const existingItems = existing ?? [];
      // Dismiss stale items on Telegram (in local but no longer on server)
      for (const item of existingItems) {
        const serverIds =
          item.kind === "question" ? serverQuestionIds : serverPermissionIds;
        if (!serverIds.has(item.request.id)) {
          dismissPromises.push(this.#grammyDismiss(item));
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
      const newQuestionItems: PendingPrompts.Item[] = questions
        .filter(
          (q) => q.sessionID === sessionId && !existingRequestIds.has(q.id),
        )
        .map((q) => ({
          kind: "question" as const,
          key: this.#nextKey(),
          request: q,
          messageId: undefined,
          currentIndex: 0,
          currentAnswers: [],
          selectedOptions: [],
        }));
      const newPermissionItems: PendingPrompts.Item[] = permissions
        .filter(
          (p) => p.sessionID === sessionId && !existingRequestIds.has(p.id),
        )
        .map((p) => ({
          kind: "permission" as const,
          key: this.#nextKey(),
          request: p,
          messageId: undefined,
        }));
      const allItems = [
        ...keptItems,
        ...newQuestionItems,
        ...newPermissionItems,
      ];
      const isPending = allItems.length > 0;
      if (isPending) {
        this.#sessionMap.set(sessionId, allItems);
      } else {
        this.#sessionMap.delete(sessionId);
      }
      if (wasPending !== isPending) {
        changedSessions.push({ sessionId, pending: isPending });
      }
    }
    const dismissResults = await Promise.allSettled(dismissPromises);
    Errors.throwIfAny(dismissResults);

    // Auto-flush + fire change hooks
    const flushPromises: Promise<void>[] = [];
    for (const sessionId of sessionIds) {
      const items = this.#sessionMap.get(sessionId);
      if (!items) continue;
      if (items.some((item) => item.messageId)) continue;
      const item = items[0];
      invariant(item, "Expected at least one item in non-empty session");
      flushPromises.push(this.#flushItem(item));
    }
    const hookPromises = changedSessions.map((change) =>
      this.#hooks.callHookWith(
        (hooks, args) => Promise.allSettled(hooks.map((hook) => hook(...args))),
        "change",
        [change],
      ),
    );
    const flushResults = await Promise.allSettled(flushPromises);
    const hookResults = (await Promise.all(hookPromises)).flat();
    Errors.throwIfAny([...flushResults, ...hookResults]);
  }

  async [Symbol.asyncDispose]() {
    this.#unhook();
    try {
      const results = await Promise.allSettled(
        [...this.#sessionMap.keys()].map((id) => this.#dismiss(id)),
      );
      Errors.throwIfAny(results);
    } catch (error) {
      logger.fatal("Failed to dismiss pending prompts", error);
      this.#shutdown.trigger();
    }
  }

  static readonly NotFoundError = class NotFoundError extends Error {
    constructor() {
      super("No pending prompt found");
    }
  };

  static readonly AnswerError = class AnswerError extends Error {
    readonly code: string;

    constructor(code: string) {
      super(`Pending prompt answer failed: ${code}`);
      this.code = code;
    }
  };

  static create(
    shutdown: Shutdown,
    bot: Bot,
    opencodeClient: OpencodeClient,
    existingSessions: ExistingSessions,
  ): PendingPrompts {
    return new PendingPrompts(shutdown, bot, opencodeClient, existingSessions);
  }
}

export namespace PendingPrompts {
  export interface Question {
    readonly kind: "question";
    readonly key: string;
    readonly request: QuestionRequest;
    messageId: number | undefined;
    currentIndex: number;
    currentAnswers: string[][];
    selectedOptions: string[];
  }

  export interface Permission {
    readonly kind: "permission";
    readonly key: string;
    readonly request: PermissionRequest;
    messageId: number | undefined;
  }

  export type Item = Question | Permission;

  export interface AnswerCallbackOptions {
    readonly sessionId: string;
    readonly callbackQueryId: string;
    readonly callbackQueryData: string;
  }

  export interface AnswerCustomOptions {
    readonly sessionId: string;
    readonly text: string;
  }

  export type AnswerOptions = AnswerCallbackOptions | AnswerCustomOptions;

  export interface ChangeEvent {
    readonly sessionId: string;
    readonly pending: boolean;
  }

  export interface Hooks {
    change: (event: ChangeEvent) => Promise<void> | void;
  }
}
