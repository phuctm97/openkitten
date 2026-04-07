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
      if (key === modelId || key === modelName || model.id === modelId) {
        return model;
      }
    }
  }
  return undefined;
}
export async function supportsInput(
  client: OpencodeClient,
  mime: string,
): Promise<boolean> {
  const normalized = normalizeMime(mime);
  const { data: config } = await client.config.get({}, { throwOnError: true });
  const modelId = config.model;
  if (!modelId) {
    return false;
  }
  const { data: providersData } = await client.config.providers(
    {},
    { throwOnError: true },
  );
  const model = findModel(providersData.providers, modelId);
  if (!model) {
    return false;
  }
  const input = model.capabilities.input;
  if (normalized.startsWith("image/")) return input.image;
  if (normalized === "application/pdf") return input.pdf;
  if (normalized.startsWith("audio/")) return input.audio;
  if (normalized.startsWith("video/")) return input.video;
  return false;
}
