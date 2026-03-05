import { rmSync } from "node:fs";
import { defineCommand } from "citty";
import pc from "picocolors";
import { CLI_ERROR, CLI_OK, CLI_SKIP } from "~/lib/constants/cli";
import { SERVICE_LOG_DIR } from "~/lib/constants/service";
import { getServiceStatus, uninstallService } from "~/lib/service";

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
			console.log(`${CLI_SKIP}Service not installed — nothing to uninstall`);
			console.log();
			process.exit(0);
		}

		// 2. Uninstall service (stops + removes service file)
		const result = await uninstallService();

		if (result.ok) {
			console.log(`${CLI_OK}Service uninstalled`);
		} else {
			console.log(`${CLI_ERROR}Failed to uninstall service`);
			console.log(`          ${pc.dim(result.reason ?? "unknown error")}`);
			console.log();
			process.exit(1);
		}

		// 3. Remove log directory
		try {
			rmSync(SERVICE_LOG_DIR, { recursive: true, force: true });
			console.log(`${CLI_OK}Removed logs (${pc.dim(SERVICE_LOG_DIR)})`);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.log(`${CLI_ERROR}Failed to remove logs`);
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
