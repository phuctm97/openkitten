import { tmpdir } from "node:os";
import path from "node:path";

export const FS_TEMP_DIR = path.join(tmpdir(), "openkitten-files");
export const FS_DATABASE_PATH = "openkitten.db";
