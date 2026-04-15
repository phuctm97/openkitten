import { createOpenKittenBotClient } from "./create-bot-client";

let client: Awaited<ReturnType<typeof createOpenKittenBotClient>> | undefined;

export async function getTelegramBotToken(xdgState?: string): Promise<string> {
  if (!client) {
    client = await createOpenKittenBotClient(xdgState);
  }
  return client.getBotToken();
}
