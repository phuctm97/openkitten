import { createOpenKittenBotClient } from "./create-bot-client";

let clientPromise: ReturnType<typeof createOpenKittenBotClient> | undefined;

export async function getBotToken(): Promise<string> {
  if (!clientPromise) {
    clientPromise = createOpenKittenBotClient();
    clientPromise.catch(() => {
      clientPromise = undefined;
    });
  }
  const client = await clientPromise;
  return client.getBotToken();
}
