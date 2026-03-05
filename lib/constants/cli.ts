import pc from "picocolors";

/** Pad each tag to align text at a consistent column.
 * Longest non-transient tag is "[missing]" (9 chars), so pad to 10. */
function tag(colorFn: (s: string) => string, label: string, width = 10) {
	return (
		colorFn(`[${label}]`) + " ".repeat(Math.max(1, width - label.length - 2))
	);
}

export const CLI_OK = tag(pc.green, "ok");
export const CLI_ERROR = tag(pc.red, "error");
export const CLI_SKIP = tag(pc.cyan, "skip");
export const CLI_MISSING = tag(pc.red, "missing");
export const CLI_WARN = tag(pc.yellow, "warn");
export const CLI_INSTALLING = tag(pc.yellow, "installing");
