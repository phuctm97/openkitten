import path from "node:path";
import { tool } from "@opencode-ai/plugin";

export default tool({
	description:
		"Attach a file to your response to send it to the user on Telegram. Supports any file type (images, documents, audio, video, etc.). The file will be delivered alongside your text response. Call multiple times to attach multiple files.",
	args: {
		path: tool.schema.string().describe("Absolute path to the file to send"),
		caption: tool.schema
			.string()
			.optional()
			.describe("Caption to display with the file"),
	},
	async execute(args) {
		const resolved = path.resolve(args.path);

		const file = Bun.file(resolved);
		if (!(await file.exists())) throw new Error(`File not found: ${resolved}`);

		const size = file.size;
		if (size > 20 * 1024 * 1024)
			throw new Error(
				`File too large (${(size / 1024 / 1024).toFixed(1)}MB). Telegram limit is 20MB.`,
			);

		return `File "${path.basename(resolved)}" attached to response.`;
	},
});
