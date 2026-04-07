import type { Model } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";
import { logger } from "~/lib/logger";

interface InputCapabilities {
  readonly image: boolean;
  readonly pdf: boolean;
  readonly audio: boolean;
  readonly video: boolean;
}

const fallbackCapabilities: InputCapabilities = {
  image: true,
  pdf: false,
  audio: false,
  video: false,
};

function normalizeMime(mime: string): string {
  const semicolon = mime.indexOf(";");
  const base = semicolon === -1 ? mime : mime.slice(0, semicolon);
  return base.trim().toLowerCase();
}

export class ModelCapabilities {
  readonly #client: OpencodeClient;
  #cached: InputCapabilities | undefined;
  #inflight: Promise<InputCapabilities> | undefined;

  private constructor(client: OpencodeClient) {
    this.#client = client;
  }

  async supportsInput(mime: string): Promise<boolean> {
    const capabilities = await this.#resolve();
    const normalized = normalizeMime(mime);
    if (normalized.startsWith("image/")) return capabilities.image;
    if (normalized === "application/pdf") return capabilities.pdf;
    if (normalized.startsWith("audio/")) return capabilities.audio;
    if (normalized.startsWith("video/")) return capabilities.video;
    return false;
  }

  invalidate(): void {
    this.#cached = undefined;
    this.#inflight = undefined;
  }

  async #resolve(): Promise<InputCapabilities> {
    if (this.#cached) return this.#cached;
    if (this.#inflight) return this.#inflight;
    this.#inflight = this.#fetch();
    try {
      const result = await this.#inflight;
      return result;
    } finally {
      this.#inflight = undefined;
    }
  }

  async #fetch(): Promise<InputCapabilities> {
    try {
      const { data: config } = await this.#client.config.get(
        {},
        { throwOnError: true },
      );
      const modelId = config.model;
      if (!modelId) {
        this.#cached = fallbackCapabilities;
        return this.#cached;
      }
      const { data: providersData } = await this.#client.config.providers(
        {},
        { throwOnError: true },
      );
      const model = findModel(providersData.providers, modelId);
      this.#cached = model
        ? {
            image: model.capabilities.input.image,
            pdf: model.capabilities.input.pdf,
            audio: model.capabilities.input.audio,
            video: model.capabilities.input.video,
          }
        : fallbackCapabilities;
      return this.#cached;
    } catch (error) {
      logger.warn("Failed to detect model capabilities, using fallback", error);
      this.#cached = fallbackCapabilities;
      return this.#cached;
    }
  }

  static create(client: OpencodeClient): ModelCapabilities {
    return new ModelCapabilities(client);
  }
}

function findModel(
  providers: ReadonlyArray<{ models: { [key: string]: Model } }>,
  modelId: string,
): Model | undefined {
  const [, ...modelParts] = modelId.split("/");
  const modelName = modelParts.join("/");
  for (const provider of providers) {
    for (const [key, model] of Object.entries(provider.models)) {
      if (key === modelId || key === modelName || model.id === modelId) {
        return model;
      }
    }
  }
  return undefined;
}
