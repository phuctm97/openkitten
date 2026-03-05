import { join, resolve } from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
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
const MISSING = tag(pc.red, "missing");
const WARN = tag(pc.yellow, "warn");
const INSTALLING = tag(pc.yellow, "installing");
const ERROR = tag(pc.red, "error");
const SKIP = tag(pc.cyan, "skip");

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

// ---------------------------------------------------------------------------
// Phase 1 — Update (graceful, never fatal)
// ---------------------------------------------------------------------------

async function updatePhase(): Promise<boolean> {
	console.log(pc.bold("Update"));
	console.log();

	let stoppedService = false;

	// 1. Check git status — if dirty, skip
	const status = await run(["git", "status", "--porcelain"]);
	if (status.exitCode !== 0 || status.stdout.length > 0) {
		const reason =
			status.exitCode !== 0
				? "failed to check git status"
				: "working tree has uncommitted changes";
		console.log(`${SKIP}Git — ${reason}`);
		console.log();
		return stoppedService;
	}

	// 2. Check branch — if not main, skip
	const branch = await run(["git", "rev-parse", "--abbrev-ref", "HEAD"]);
	if (branch.exitCode !== 0 || branch.stdout !== "main") {
		console.log(`${SKIP}Git — not on main branch (on "${branch.stdout}")`);
		console.log();
		return stoppedService;
	}

	// 3. Fetch origin main — if fails, warn and continue
	const fetch = await run(["git", "fetch", "origin", "main"]);
	if (fetch.exitCode !== 0) {
		console.log(`${WARN}Failed to fetch from origin`);
		console.log(`          ${pc.dim(fetch.stderr)}`);
		console.log();
		return stoppedService;
	}

	// 4. Compare HEAD vs origin/main
	const head = await run(["git", "rev-parse", "HEAD"]);
	const remote = await run(["git", "rev-parse", "origin/main"]);
	if (head.exitCode !== 0 || remote.exitCode !== 0) {
		console.log(`${WARN}Failed to resolve git revisions`);
		console.log();
		return stoppedService;
	}
	if (head.stdout === remote.stdout) {
		console.log(`${OK}Already up to date`);
		console.log();
		return stoppedService;
	}

	// 5. Show incoming commits
	const log = await run(["git", "log", "HEAD..origin/main", "--oneline"]);
	if (log.stdout.length > 0) {
		console.log(pc.bold("  Incoming changes:"));
		for (const line of log.stdout.split("\n")) {
			console.log(`  ${pc.dim(line)}`);
		}
		console.log();
	}

	// 6. Stop service if running
	const serviceStatus = await getServiceStatus();
	if (serviceStatus.installed && serviceStatus.running) {
		const platform = supportedPlatform();
		if (platform === "darwin") {
			await run(["launchctl", "unload", serviceStatus.path]);
		} else if (platform === "linux") {
			await run(["systemctl", "--user", "stop", "openkitten.service"]);
		}
		console.log(`${OK}Stopped system service`);
		stoppedService = true;
	}

	// 7. git pull --ff-only — if fails, warn and continue
	const pull = await run(["git", "pull", "--ff-only", "origin", "main"]);
	if (pull.exitCode !== 0) {
		console.log(`${WARN}Failed to pull changes`);
		console.log(`          ${pc.dim(pull.stderr)}`);
	} else {
		console.log(`${OK}Pulled latest changes`);
	}

	// 8. bun install — if fails, warn and continue
	const install = await run(["bun", "install"]);
	if (install.exitCode !== 0) {
		console.log(`${WARN}Failed to install dependencies`);
		console.log(`          ${pc.dim(install.stderr)}`);
	} else {
		console.log(`${OK}Dependencies installed`);
	}

	console.log();
	return stoppedService;
}

// ---------------------------------------------------------------------------
// Phase 2 — Setup
// ---------------------------------------------------------------------------

function checkBun(): boolean {
	console.log(`${OK}Bun v${Bun.version}`);
	return true;
}

async function checkOpencode(): Promise<boolean> {
	const which = Bun.which("opencode");
	if (which) {
		console.log(`${OK}opencode CLI (${pc.dim(which)})`);
		return true;
	}

	const localBin = join(process.cwd(), "node_modules", ".bin", "opencode");
	if (await Bun.file(localBin).exists()) {
		console.log(`${OK}opencode CLI (${pc.dim(localBin)})`);
		return true;
	}

	console.log(`${INSTALLING}opencode CLI — running \`bun add opencode-ai\`...`);
	const proc = Bun.spawn(["bun", "add", "opencode-ai"], {
		stdout: "ignore",
		stderr: "pipe",
	});
	const exitCode = await proc.exited;

	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		console.log(`${ERROR}opencode CLI — failed to install`);
		console.log(`          ${pc.dim(stderr.trim())}`);
		return false;
	}

	const installedBin = join(process.cwd(), "node_modules", ".bin", "opencode");
	if (await Bun.file(installedBin).exists()) {
		console.log(`${OK}opencode CLI (${pc.dim(installedBin)})`);
		return true;
	}

	console.log(`${ERROR}opencode CLI — installed but binary not found`);
	return false;
}

function checkTelegramEnv(): boolean {
	let ok = true;

	const token = process.env.TELEGRAM_BOT_TOKEN;
	if (token) {
		console.log(`${OK}TELEGRAM_BOT_TOKEN`);
	} else {
		ok = false;
		console.log(`${MISSING}TELEGRAM_BOT_TOKEN`);
		console.log(
			`          Create a bot via ${pc.bold("@BotFather")} on Telegram and set:`,
		);
		console.log(
			`          ${pc.dim('TELEGRAM_BOT_TOKEN="your-token"')} in .env.local`,
		);
	}

	const rawUserId = process.env.TELEGRAM_USER_ID;
	if (rawUserId) {
		const userId = Number(rawUserId);
		if (Number.isNaN(userId) || userId <= 0 || !Number.isInteger(userId)) {
			ok = false;
			console.log(
				`${MISSING}TELEGRAM_USER_ID (${pc.dim(`invalid: "${rawUserId}"`)})`,
			);
			console.log(`          Must be a positive integer.`);
			console.log(
				`          Send /start to ${pc.bold("@userinfobot")} on Telegram to find your ID.`,
			);
		} else {
			console.log(`${OK}TELEGRAM_USER_ID (${userId})`);
		}
	} else {
		ok = false;
		console.log(`${MISSING}TELEGRAM_USER_ID`);
		console.log(
			`          Send /start to ${pc.bold("@userinfobot")} on Telegram to find your numeric user ID.`,
		);
		console.log(
			`          ${pc.dim('TELEGRAM_USER_ID="your-id"')} in .env.local`,
		);
	}

	return ok;
}

async function ensureServerPassword(): Promise<void> {
	if (process.env.OPENCODE_SERVER_PASSWORD) {
		console.log(`${OK}OPENCODE_SERVER_PASSWORD`);
		return;
	}

	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const password = Buffer.from(bytes).toString("hex");
	const envFile = join(process.cwd(), ".env.local");

	try {
		const existing = (await Bun.file(envFile).exists())
			? await Bun.file(envFile).text()
			: "";
		await Bun.write(
			envFile,
			`${existing}\nOPENCODE_SERVER_PASSWORD="${password}"\n`,
			{
				mode: 0o600,
			},
		);
		process.env.OPENCODE_SERVER_PASSWORD = password;
		console.log(`${OK}OPENCODE_SERVER_PASSWORD (generated)`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(`${WARN}OPENCODE_SERVER_PASSWORD — failed to write .env.local`);
		console.log(`          ${pc.dim(msg)}`);
	}
}

function checkSandbox() {
	try {
		const supported = SandboxManager.isSupportedPlatform();
		if (!supported) {
			console.log(
				`${WARN}Sandbox — platform not supported (${process.platform}/${process.arch})`,
			);
			console.log(
				`          The bot will still work with DANGEROUSLY_DISABLE_SANDBOX=1.`,
			);
			return;
		}

		const { warnings, errors } = SandboxManager.checkDependencies();

		if (errors.length > 0) {
			console.log(`${WARN}Sandbox`);
			for (const e of errors) {
				console.log(`          ${pc.red(e)}`);
			}
			for (const w of warnings) {
				console.log(`          ${pc.yellow(w)}`);
			}
			return;
		}

		if (warnings.length > 0) {
			console.log(`${WARN}Sandbox`);
			for (const w of warnings) {
				console.log(`          ${pc.yellow(w)}`);
			}
			return;
		}

		console.log(`${OK}Sandbox`);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(`${WARN}Sandbox — check failed`);
		console.log(`          ${pc.dim(msg)}`);
	}
}

async function checkService(forceRestart: boolean): Promise<void> {
	try {
		const platform = supportedPlatform();
		if (!platform) {
			console.log(
				`${WARN}System service — not supported on ${process.platform}`,
			);
			return;
		}

		const status = await getServiceStatus();

		if (status.installed && status.running) {
			// Always restart so the service picks up any env / code changes
			console.log(`${INSTALLING}System service — restarting...`);
			const result = await installService();
			if (result.ok) {
				console.log(`${OK}System service — restarted (${pc.dim(result.path)})`);
			} else {
				console.log(`${WARN}System service — restart failed`);
				console.log(`          ${pc.dim(result.reason)}`);
			}
			return;
		}

		if (status.installed && !status.running) {
			if (forceRestart) {
				// Service was stopped by update phase — restart it
				console.log(`${INSTALLING}System service — restarting...`);
				const result = await installService();
				if (result.ok) {
					console.log(
						`${OK}System service — restarted (${pc.dim(result.path)})`,
					);
				} else {
					console.log(`${WARN}System service — restart failed`);
					console.log(`          ${pc.dim(result.reason)}`);
				}
			} else {
				const hint =
					platform === "darwin"
						? `launchctl load ${status.path}`
						: "systemctl --user start openkitten.service";
				console.log(`${WARN}System service — installed but not running`);
				console.log(`          Run ${pc.dim(hint)} to start it.`);
			}
			return;
		}

		// Not installed — attempt install
		console.log(`${INSTALLING}System service...`);
		const result = await installService();

		if (result.ok) {
			console.log(`${OK}System service (${pc.dim(result.path)})`);
		} else {
			console.log(`${WARN}System service — install failed`);
			console.log(`          ${pc.dim(result.reason)}`);
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(`${WARN}System service — check failed`);
		console.log(`          ${pc.dim(msg)}`);
	}
}

async function setupPhase(stoppedService: boolean): Promise<boolean> {
	console.log(pc.bold("Setup"));
	console.log();

	let hasFailed = false;

	// 1. Bun runtime
	checkBun();

	// 2. opencode CLI
	const opencodeOk = await checkOpencode();
	if (!opencodeOk) hasFailed = true;

	console.log();

	// 3. Telegram env vars
	const telegramOk = checkTelegramEnv();
	if (!telegramOk) hasFailed = true;

	console.log();

	// 4. Server password (informational)
	await ensureServerPassword();

	console.log();

	// 5. Sandbox (informational)
	checkSandbox();

	console.log();

	// 6. System service
	await checkService(stoppedService);

	return hasFailed;
}

export default defineCommand({
	meta: { description: "Update and set up openkitten" },
	run: async () => {
		console.log();
		console.log(pc.bold("openkitten up"));
		console.log("==================");
		console.log();

		// Phase 1 — Update
		const stoppedService = await updatePhase();

		// Phase 2 — Setup
		const hasFailed = await setupPhase(stoppedService);

		// Footer
		console.log();
		console.log("------------------");
		if (hasFailed) {
			console.log(
				pc.red("Some required checks failed. Fix the issues above and re-run."),
			);
		} else {
			console.log(
				pc.green("Ready!") +
					" The bot will start automatically, or run `bun start` to launch manually.",
			);
		}
		console.log();

		process.exit(hasFailed ? 1 : 0);
	},
});
