import type { FilePartInput, TextPartInput } from "@opencode-ai/sdk/v2";
import type { Api, Context } from "grammy";
import type { BotContext } from "~/lib/context";
import { stopTyping } from "~/lib/events";
import { sendNotice } from "~/lib/notice";
import { getClient, getDirectory } from "~/lib/opencode";
import { saveSessionID } from "~/lib/session";

export const SESSION_LOCKED_RETRY_DELAY_MS = 1000;
export const SESSION_LOCKED_MAX_RETRIES = 3;

export async function promptOpenCode(
	ctx: Context,
	parts: Array<TextPartInput | FilePartInput>,
	botCtx: BotContext,
	botApi: Api,
	ensureSubscription: (directory: string, chatId: number) => void,
): Promise<void> {
	if (!ctx.chat) return;
	const chatId = ctx.chat.id;
	const directory = getDirectory();
	ensureSubscription(directory, chatId);

	// Auto-create session if none exists
	let sessionID = botCtx.sessionID;
	if (!sessionID) {
		const client = getClient();
		const { data: newSession, error } = await client.session.create({
			directory,
		});
		if (error || !newSession) {
			sendNotice(ctx.api, chatId, "error", "Failed to create session.");
			return;
		}
		sessionID = newSession.id;
		botCtx.sessionID = sessionID;
		saveSessionID(sessionID);
	}

	// Fire-and-forget with SessionLockedError retry
	const prompt = async (retries = 0): Promise<void> => {
		const { error } = await getClient().session.prompt({
			sessionID,
			directory,
			parts,
		});

		if (error) {
			const errMsg =
				typeof error === "object" && "message" in error
					? (error as { message: string }).message
					: String(error);

			if (errMsg.includes("SessionLocked")) {
				if (retries < SESSION_LOCKED_MAX_RETRIES) {
					console.log(
						`[bot] Session locked, retrying in ${SESSION_LOCKED_RETRY_DELAY_MS}ms (attempt ${retries + 1})`,
					);
					await new Promise((r) =>
						setTimeout(r, SESSION_LOCKED_RETRY_DELAY_MS),
					);
					return prompt(retries + 1);
				}
				sendNotice(
					botApi,
					chatId,
					"busy",
					"Still processing the previous message. Use /stop to abort.",
				);
				return;
			}

			console.error("[bot] prompt error:", error);
			stopTyping(botCtx);
			sendNotice(botApi, chatId, "error", errMsg);
		}
	};

	prompt().catch((err) => {
		console.error("[bot] prompt error:", err);
		stopTyping(botCtx);
		sendNotice(botApi, chatId, "error", "Error sending prompt.");
	});
}
