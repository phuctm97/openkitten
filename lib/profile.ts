import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Errors } from "~/lib/errors";

export class Profile {
  readonly #dir: string;

  private constructor(dir: string) {
    this.#dir = dir;
  }

  get dir(): string {
    return this.#dir;
  }

  get system(): string {
    return join(this.#dir, "system");
  }

  get workspace(): string {
    return join(this.#dir, "workspace");
  }

  get auth(): string {
    return join(this.system, "data", "openkitten", "auth.json");
  }

  get database(): string {
    return join(this.system, "data", "openkitten", "openkitten.db");
  }

  get opencode(): string {
    return join(this.#dir, ".opencode");
  }

  get xdgData(): string {
    return join(this.system, "data");
  }

  get xdgConfig(): string {
    return join(this.system, "config");
  }

  get xdgState(): string {
    return join(this.system, "state");
  }

  get xdgCache(): string {
    return join(this.system, "cache");
  }

  static async create(name?: string): Promise<Profile> {
    const profile = name || "default";
    const dir = join(homedir(), ".openkitten", "profiles", profile);
    const results = await Promise.allSettled([
      mkdir(join(dir, "system", "data", "openkitten"), { recursive: true }),
      mkdir(join(dir, "workspace"), { recursive: true }),
      mkdir(join(dir, ".opencode"), { recursive: true }),
    ]);
    Errors.throwIfAny(results);
    return new Profile(dir);
  }
}
