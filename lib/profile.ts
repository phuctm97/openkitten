import { mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { Errors } from "~/lib/errors";

export class Profile {
  readonly #name: string;

  private constructor(name: string) {
    this.#name = name;
  }

  async #prepare(): Promise<void> {
    const results = await Promise.allSettled([
      mkdir(this.workspace, { recursive: true }),
      mkdir(join(this.xdgData, "openkitten"), { recursive: true }),
      mkdir(join(this.xdgConfig, "openkitten"), { recursive: true }),
    ]);
    Errors.throwIfAny(results);
  }

  get name(): string {
    return this.#name;
  }

  get dir(): string {
    return join(homedir(), ".openkitten", "profiles", this.#name);
  }

  get system(): string {
    return join(this.dir, "system");
  }

  get workspace(): string {
    return join(this.dir, "workspace");
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

  static async create(): Promise<Profile> {
    const profile = new Profile(Bun.env["OPENKITTEN_PROFILE"] || "default");
    await profile.#prepare();
    return profile;
  }
}
