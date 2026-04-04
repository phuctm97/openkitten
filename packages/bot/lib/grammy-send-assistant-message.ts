import type { Part } from "@opencode-ai/sdk/v2";
import { InputFile, InputMediaBuilder } from "grammy";
import { extension as mimeExtension, lookup as mimeLookup } from "mime-types";
import invariant from "tiny-invariant";
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
  readonly kind: AttachmentKind;
  readonly media: InputFile;
}

type AttachmentKind = "animation" | "audio" | "document" | "photo" | "video";
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
        InputMediaBuilder.audio(attachment.media),
      );
    case "document":
      return attachments.map((attachment) =>
        InputMediaBuilder.document(attachment.media),
      );
    case "visual":
      return attachments.map((attachment) =>
        attachment.kind === "photo"
          ? InputMediaBuilder.photo(attachment.media)
          : InputMediaBuilder.video(attachment.media),
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
      await bot.api.sendAnimation(chatId, attachment.media, sendOpts);
      return;
    case "audio":
      await bot.api.sendAudio(chatId, attachment.media, sendOpts);
      return;
    case "document":
      await bot.api.sendDocument(chatId, attachment.media, sendOpts);
      return;
    case "photo":
      await bot.api.sendPhoto(chatId, attachment.media, sendOpts);
      return;
    case "video":
      await bot.api.sendVideo(chatId, attachment.media, sendOpts);
      return;
  }
}

async function createTelegramAttachment(
  file: FilePart,
  index: number,
): Promise<TelegramAttachment> {
  const response = await fetch(file.url);
  const bytes = new Uint8Array(await response.arrayBuffer());
  const filename = attachmentFilename(file, index);
  return {
    kind: attachmentKind(file, filename),
    media: new InputFile(bytes, filename),
  };
}

function attachmentFilename(file: FilePart, index: number): string {
  const name = cleanText(file.filename);
  if (name) return name;

  const ext = mimeExtension(file.mime);
  return ext ? `attachment-${index + 1}.${ext}` : `attachment-${index + 1}`;
}

function attachmentKind(file: FilePart, filename: string): AttachmentKind {
  const mime = attachmentMimeType(file, filename);
  const ext = fileExtension(filename);

  if (mime === "image/gif" || ext === "gif") return "animation";

  if (
    mime === "image/jpeg" ||
    mime === "image/png" ||
    mime === "image/webp" ||
    ext === "jpeg" ||
    ext === "jpg" ||
    ext === "png" ||
    ext === "webp"
  ) {
    return "photo";
  }

  if (
    mime?.startsWith("video/") ||
    ext === "m4v" ||
    ext === "mov" ||
    ext === "mp4" ||
    ext === "webm"
  ) {
    return "video";
  }

  if (mime?.startsWith("audio/")) return "audio";

  return "document";
}

function attachmentMimeType(
  file: FilePart,
  filename: string,
): string | undefined {
  const partMime = cleanText(file.mime)?.toLowerCase();
  if (partMime && partMime !== "application/octet-stream") return partMime;

  const filenameMime = mimeLookup(filename);
  if (typeof filenameMime === "string") return filenameMime.toLowerCase();

  return partMime;
}

function fileExtension(filename: string): string | undefined {
  const index = filename.lastIndexOf(".");
  if (index < 0 || index === filename.length - 1) return undefined;
  return filename.slice(index + 1).toLowerCase();
}

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}
