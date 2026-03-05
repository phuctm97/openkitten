import { cliTag, pc } from "~/lib/cli-tag";

export const CLI_OK = cliTag(pc.green, "ok");
export const CLI_ERROR = cliTag(pc.red, "error");
export const CLI_SKIP = cliTag(pc.cyan, "skip");
export const CLI_MISSING = cliTag(pc.red, "missing");
export const CLI_WARN = cliTag(pc.yellow, "warn");
export const CLI_INSTALLING = cliTag(pc.yellow, "installing");
