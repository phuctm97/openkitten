import zod from "zod";

export const attachmentKindSchema = zod.enum([
  "sticker",
  "animation",
  "document",
  "photo",
  "video",
  "audio",
]);
