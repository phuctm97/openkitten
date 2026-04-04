import type zod from "zod";
import type { attachmentKindSchema } from "~/lib/attachment-kind-schema";

export type AttachmentKind = zod.output<typeof attachmentKindSchema>;
