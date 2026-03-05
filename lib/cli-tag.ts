import pc from "picocolors";

/** Pad each tag to align text at a consistent column.
 * Longest non-transient tag is "[missing]" (9 chars), so pad to 10. */
export function cliTag(
	colorFn: (s: string) => string,
	label: string,
	width = 10,
) {
	return (
		colorFn(`[${label}]`) + " ".repeat(Math.max(1, width - label.length - 2))
	);
}

export { pc };
