import type { Part } from "@opencode-ai/sdk/v2";
import { InputFile, InputMediaBuilder } from "grammy";
import invariant from "tiny-invariant";
import { getAttachmentKind } from "~/lib/get-attachment-kind";
import { getAttachmentName } from "~/lib/get-attachment-name";
import { grammyBuildAssistantMessageSections } from "~/lib/grammy-build-assistant-message-sections";
import { grammyFormatText } from "~/lib/grammy-format-text";
import { grammyRenderAssistantMessageSection } from "~/lib/grammy-render-assistant-message-section";
import type { GrammySendAssistantMessageOptions } from "~/lib/grammy-send-assistant-message-options";
import { grammySendChunks } from "~/lib/grammy-send-chunks";

type AssistantMessageSection = ReturnType<
  typeof grammyBuildAssistantMessageSections
>[number];
type AttachmentSection = Extract<
  AssistantMessageSection,
  { type: "attachment" }
>;
type FilePart = Extract<Part, { type: "file" }>;

interface TelegramAttachment {
  readonly file: InputFile;
  readonly kind: AttachmentKind;
  readonly name: string;
}

type AttachmentKind =
  | "sticker"
  | "animation"
  | "document"
  | "photo"
  | "video"
  | "audio";
type MediaGroupKind = "audio" | "document" | "visual";

export async function grammySendAssistantMessage({
  bot,
  chatId,
  info,
  parts,
  replyToMessageId,
  threadId,
}: GrammySendAssistantMessageOptions): Promise<void> {
  const sections = grammyBuildAssistantMessageSections(info, parts);
  const renderedSections: string[] = [];
  let replyPending = replyToMessageId;

  async function flushRenderedSections() {
    if (renderedSections.length === 0) return;

    const chunks = grammyFormatText(renderedSections.join("\n\n"));
    renderedSections.length = 0;

    await grammySendChunks({
      bot,
      chatId,
      chunks,
      replyToMessageId: replyPending,
      threadId,
    });
    replyPending = undefined;
  }

  for (const section of sections) {
    if (section.type === "attachment") {
      await flushRenderedSections();
      await sendAttachmentSection({
        bot,
        chatId,
        replyToMessageId: replyPending,
        section,
        threadId,
      });
      replyPending = undefined;
      continue;
    }

    const rendered = grammyRenderAssistantMessageSection(section);
    if (!rendered) continue;
    renderedSections.push(rendered);
  }

  await flushRenderedSections();
}

async function sendAttachmentSection({
  bot,
  chatId,
  replyToMessageId,
  section,
  threadId,
}: Omit<GrammySendAssistantMessageOptions, "info" | "parts"> & {
  readonly section: AttachmentSection;
}): Promise<void> {
  const attachments = await Promise.all(
    section.files.map((file, index) => createTelegramAttachment(file, index)),
  );

  for (let index = 0; index < attachments.length; ) {
    const attachment = attachments[index];
    invariant(attachment, "Attachment section contained no files");
    const groupKind = mediaGroupKind(attachment);
    const group =
      groupKind === undefined
        ? []
        : collectMediaGroup(attachments, index, groupKind);

    if (groupKind && group.length >= 2) {
      await bot.api.sendMediaGroup(chatId, createMediaGroup(group, groupKind), {
        ...(threadId && { message_thread_id: threadId }),
        ...(replyToMessageId && {
          reply_parameters: { message_id: replyToMessageId },
        }),
      });
      replyToMessageId = undefined;
      index += group.length;
      continue;
    }

    await sendSingleAttachment({
      attachment,
      bot,
      chatId,
      replyToMessageId,
      threadId,
    });
    replyToMessageId = undefined;
    index += 1;
  }
}

function collectMediaGroup(
  attachments: readonly TelegramAttachment[],
  startIndex: number,
  kind: MediaGroupKind,
): readonly TelegramAttachment[] {
  const group: TelegramAttachment[] = [];

  for (const attachment of attachments.slice(startIndex)) {
    if (mediaGroupKind(attachment) !== kind) break;
    group.push(attachment);
    if (group.length === 10) break;
  }

  return group;
}

function createMediaGroup(
  attachments: readonly TelegramAttachment[],
  kind: MediaGroupKind,
) {
  switch (kind) {
    case "audio":
      return attachments.map((attachment) =>
        InputMediaBuilder.audio(attachment.file),
      );
    case "document":
      return attachments.map((attachment) =>
        InputMediaBuilder.document(attachment.file),
      );
    case "visual":
      return attachments.map((attachment) =>
        attachment.kind === "photo"
          ? InputMediaBuilder.photo(attachment.file)
          : InputMediaBuilder.video(attachment.file),
      );
  }
}

function mediaGroupKind(
  attachment: TelegramAttachment,
): MediaGroupKind | undefined {
  switch (attachment.kind) {
    case "audio":
      return "audio";
    case "document":
      return "document";
    case "photo":
    case "video":
      return "visual";
    case "animation":
    case "sticker":
      return undefined;
  }
}

async function sendSingleAttachment({
  attachment,
  bot,
  chatId,
  replyToMessageId,
  threadId,
}: Omit<GrammySendAssistantMessageOptions, "info" | "parts"> & {
  readonly attachment: TelegramAttachment;
}) {
  const sendOpts = {
    ...(threadId && { message_thread_id: threadId }),
    ...(replyToMessageId && {
      reply_parameters: { message_id: replyToMessageId },
    }),
  };

  switch (attachment.kind) {
    case "animation":
      await bot.api.sendAnimation(chatId, attachment.file, sendOpts);
      return;
    case "audio":
      await bot.api.sendAudio(chatId, attachment.file, sendOpts);
      return;
    case "document":
      await bot.api.sendDocument(chatId, attachment.file, sendOpts);
      return;
    case "photo":
      await bot.api.sendPhoto(chatId, attachment.file, sendOpts);
      return;
    case "sticker":
      await bot.api.sendSticker(chatId, attachment.file, sendOpts);
      return;
    case "video":
      await bot.api.sendVideo(chatId, attachment.file, sendOpts);
      return;
  }
}

async function createTelegramAttachment(
  file: FilePart,
  index: number,
): Promise<TelegramAttachment> {
  const response = await fetch(file.url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const name = getAttachmentName(
    file.filename,
    file.mime,
    `attachment-${index + 1}`,
  );
  return {
    file: new InputFile(bytes, name),
    kind: getAttachmentKind(file.mime, name),
    name,
  };
}
