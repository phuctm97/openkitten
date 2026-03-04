import { rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import { getServiceStatus, uninstallService } from "~/lib/service";

const LOG_DIR = join(homedir(), ".local", "log", "openkitten");

function tag(colorFn: (s: string) => string, label: string, width = 10) {
	return (
		colorFn(`[${label}]`) + " ".repeat(Math.max(1, width - label.length - 2))
	);
}

const OK = tag(pc.green, "ok");
const ERROR = tag(pc.red, "error");
const SKIP = tag(pc.cyan, "skip");

export default defineCommand({
	meta: { description: "Stop and uninstall openkitten" },
	run: async () => {
		console.log();
		console.log(pc.bold("openkitten down"));
		console.log("==================");
		console.log();

		// 1. Check current service status
		const status = await getServiceStatus();

		if (!status.installed) {
			console.log(`${SKIP}Service not installed — nothing to uninstall`);
			console.log();
			process.exit(0);
		}

		// 2. Uninstall service (stops + removes service file)
		const result = await uninstallService();

		if (result.ok) {
			console.log(`${OK}Service uninstalled`);
		} else {
			console.log(`${ERROR}Failed to uninstall service`);
			console.log(`          ${pc.dim(result.reason ?? "unknown error")}`);
			console.log();
			process.exit(1);
		}

		// 3. Remove log directory
		try {
			rmSync(LOG_DIR, { recursive: true, force: true });
			console.log(`${OK}Removed logs (${pc.dim(LOG_DIR)})`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`${ERROR}Failed to remove logs`);
			console.log(`          ${pc.dim(msg)}`);
		}

		// Footer
		console.log();
		console.log("------------------");
		console.log(
			pc.green("Done!") +
				" Service stopped and uninstalled. Run `bun openkitten-up` to reinstall.",
		);
		console.log();
	},
});
