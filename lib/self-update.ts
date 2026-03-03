import { resolve } from "node:path";
import { defineCommand } from "citty";
import pc from "picocolors";
import {
	getServiceStatus,
	installService,
	supportedPlatform,
} from "~/lib/service";

const PROJECT_DIR = resolve(import.meta.dirname, "..");

// Pad each tag to align text at a consistent column.
// Longest non-transient tag is "[missing]" (9 chars), so pad to 10.
function tag(colorFn: (s: string) => string, label: string, width = 10) {
	return (
		colorFn(`[${label}]`) + " ".repeat(Math.max(1, width - label.length - 2))
	);
}

const OK = tag(pc.green, "ok");
const ERROR = tag(pc.red, "error");

async function run(
	cmd: string[],
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn(cmd, {
		cwd: PROJECT_DIR,
		stdout: "pipe",
		stderr: "pipe",
	});
	const exitCode = await proc.exited;
	const stdout = await new Response(proc.stdout).text();
	const stderr = await new Response(proc.stderr).text();
	return { exitCode, stdout: stdout.trim(), stderr: stderr.trim() };
}

async function restartService() {
	const result = await installService();
	if (result.ok) {
		console.log(`${OK}Restarted system service`);
	} else {
		console.log(`${ERROR}Failed to restart system service`);
		console.log(`          ${pc.dim(result.reason)}`);
	}
}

export default defineCommand({
	meta: { description: "Update openkitten to the latest version" },
	run: async () => {
		console.log();
		console.log(pc.bold("openkitten self-update"));
		console.log("======================");
		console.log();

		// 1. Check git status — abort if working tree is dirty
		const status = await run(["git", "status", "--porcelain"]);
		if (status.exitCode !== 0) {
			console.log(`${ERROR}Failed to check git status`);
			console.log(`          ${pc.dim(status.stderr)}`);
			process.exitCode = 1;
			return;
		}
		if (status.stdout.length > 0) {
			console.log(`${ERROR}Working tree has uncommitted changes`);
			console.log("          Commit or stash your changes before updating.");
			console.log();
			process.exitCode = 1;
			return;
		}
		console.log(`${OK}Working tree is clean`);

		// 2. Verify we're on the main branch
		const branch = await run(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
		if (branch.exitCode !== 0 || branch.stdout !== "main") {
			console.log(`${ERROR}Not on the main branch (on "${branch.stdout}")`);
			console.log(
				"          Switch to main before updating: git checkout main",
			);
			console.log();
			process.exitCode = 1;
			return;
		}
		console.log(`${OK}On branch main`);

		// 3. Fetch latest from origin
		const fetch = await run(["git", "fetch", "origin", "main"]);
		if (fetch.exitCode !== 0) {
			console.log(`${ERROR}Failed to fetch from origin`);
			console.log(`          ${pc.dim(fetch.stderr)}`);
			process.exitCode = 1;
			return;
		}
		console.log(`${OK}Fetched latest from origin/main`);

		// 4. Compare HEAD vs origin/main
		const head = await run(["git", "rev-parse", "HEAD"]);
		const remote = await run(["git", "rev-parse", "origin/main"]);
		if (head.exitCode !== 0 || remote.exitCode !== 0) {
			console.log(`${ERROR}Failed to resolve git revisions`);
			process.exitCode = 1;
			return;
		}
		if (head.stdout === remote.stdout) {
			console.log(`${OK}Already up to date`);
			console.log();
			return;
		}

		// 5. Show incoming commits
		const log = await run(["git", "log", "HEAD..origin/main", "--oneline"]);
		if (log.stdout.length > 0) {
			console.log();
			console.log(pc.bold("Incoming changes:"));
			for (const line of log.stdout.split("\n")) {
				console.log(`  ${pc.dim(line)}`);
			}
			console.log();
		}

		// 6. Stop service if running
		let wasRunning = false;
		const serviceStatus = await getServiceStatus();
		if (serviceStatus.installed && serviceStatus.running) {
			wasRunning = true;
			const platform = supportedPlatform();
			if (platform === "darwin") {
				await run(["launchctl", "unload", serviceStatus.path]);
			} else if (platform === "linux") {
				await run(["systemctl", "--user", "stop", "openkitten.service"]);
			}
			console.log(`${OK}Stopped system service`);
		}

		// 7. Pull changes
		const pull = await run(["git", "pull", "--ff-only", "origin", "main"]);
		if (pull.exitCode !== 0) {
			console.log(`${ERROR}Failed to pull changes`);
			console.log(`          ${pc.dim(pull.stderr)}`);
			if (wasRunning) await restartService();
			process.exitCode = 1;
			return;
		}
		console.log(`${OK}Pulled latest changes`);

		// 8. Install dependencies
		const install = await run(["bun", "install"]);
		if (install.exitCode !== 0) {
			console.log(`${ERROR}Failed to install dependencies`);
			console.log(`          ${pc.dim(install.stderr)}`);
			if (wasRunning) await restartService();
			process.exitCode = 1;
			return;
		}
		console.log(`${OK}Dependencies installed`);

		// 9. Restart service if it was running before update
		if (wasRunning) await restartService();

		console.log();
		console.log(pc.green("Update complete!"));
		console.log();
	},
});
