/** Escape special characters for Telegram Markdown (v1) parse mode. */
export function escapeMarkdown(text: string): string {
	return text.replace(/[\\_*`[]/g, "\\$&");
}
