import type { Model } from "@opencode-ai/sdk/v2";
import type { OpencodeClient } from "@opencode-ai/sdk/v2/client";

function normalizeMime(mime: string): string {
  const semicolon = mime.indexOf(";");
  const base = semicolon === -1 ? mime : mime.slice(0, semicolon);
  return base.trim().toLowerCase();
}

function findModel(
  providers: ReadonlyArray<{ models: { [key: string]: Model } }>,
  modelId: string,
): Model | undefined {
  const [, ...modelParts] = modelId.split("/");
  const modelName = modelParts.join("/");
  for (const provider of providers) {
    for (const [key, model] of Object.entries(provider.models)) {
      if (key === modelId) return model;
      if (key === modelName) return model;
      if (model.id === modelId) return model;
    }
  }
  return undefined;
}

function resolveDefaultModel(defaults: {
  [key: string]: string;
}): string | undefined {
  const values = Object.values(defaults);
  return values.length > 0 ? values[0] : undefined;
}

function checkInput(
  input: Model["capabilities"]["input"],
  mime: string,
): boolean {
  if (mime.startsWith("image/")) return input.image;
  if (mime === "application/pdf") return input.pdf;
  if (mime.startsWith("audio/")) return input.audio;
  if (mime.startsWith("video/")) return input.video;
  return false;
}

export async function modelSupportsFile(
  client: OpencodeClient,
  mime: string,
): Promise<boolean> {
  const normalized = normalizeMime(mime);
  const { data: config } = await client.config.get({}, { throwOnError: true });
  const { data: providersData } = await client.config.providers(
    {},
    { throwOnError: true },
  );
  const modelId = config.model ?? resolveDefaultModel(providersData.default);
  if (!modelId) return false;
  const model = findModel(providersData.providers, modelId);
  if (!model) return false;
  return checkInput(model.capabilities.input, normalized);
}
