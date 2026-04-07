import { mkdir } from "node:fs/promises";
import { basename, join } from "node:path";

export class AttachmentStorage {
  readonly #dir: string;

  private constructor(dir: string) {
    this.#dir = dir;
  }

  async write(filename: string, data: Uint8Array): Promise<string> {
    await mkdir(this.#dir, { recursive: true });
    const safeName = basename(filename) || "attachment";
    const path = join(this.#dir, `${crypto.randomUUID()}-${safeName}`);
    await Bun.write(path, data);
    return path;
  }

  static create(workspace: string): AttachmentStorage {
    return new AttachmentStorage(join(workspace, ".attachments"));
  }
}
