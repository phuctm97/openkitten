import { homedir } from "node:os";
import { join, resolve } from "node:path";

export const SERVICE_LAUNCHCTL_NAME = "com.openkitten.bot";
export const SERVICE_SYSTEMCTL_NAME = "openkitten.service";
export const SERVICE_ENV_FILE_MODE = 0o600;
export const SERVICE_PROJECT_DIR = resolve(import.meta.dirname, "../..");
export const SERVICE_LOG_DIR = join(homedir(), ".local", "log", "openkitten");
