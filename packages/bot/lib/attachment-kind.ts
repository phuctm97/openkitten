import type { output } from "zod";

export type AttachmentKind = output<
  typeof import("~/lib/attachment-kind-schema").attachmentKindSchema
>;
