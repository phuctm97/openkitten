import { mkdir } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { extension } from "mime-types";

export class AttachmentStorage {
  readonly #dir: string;

  private constructor(dir: string) {
    this.#dir = dir;
  }

  async write(
    fileId: string,
    filename: string,
    mime: string,
    data: Uint8Array,
  ): Promise<string> {
    const safeName = basename(filename) || "attachment";
    const ext = extname(safeName) || `.${extension(mime) || "bin"}`;
    const dir = join(this.#dir, fileId);
    await mkdir(dir, { recursive: true });
    const path = join(
      dir,
      `${safeName}${ext === extname(safeName) ? "" : ext}`,
    );
    await Bun.write(path, data);
    return path;
  }

  static create(workspace: string): AttachmentStorage {
    return new AttachmentStorage(join(workspace, ".openkitten"));
  }
}
