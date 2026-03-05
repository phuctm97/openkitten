import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const SERVICE_LABEL = "com.openkitten.bot";
export const SERVICE_PROJECT_DIR = resolve(import.meta.dirname, "../..");
export const SERVICE_LOG_DIR = join(homedir(), ".local", "log", "openkitten");
