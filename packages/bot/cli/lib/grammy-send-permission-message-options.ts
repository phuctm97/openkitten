import type { PermissionRequest } from "@opencode-ai/sdk/v2";
import type { GrammySendOptions } from "~/lib/grammy-send-options";

export interface GrammySendPermissionMessageOptions extends GrammySendOptions {
  readonly request: PermissionRequest;
}
