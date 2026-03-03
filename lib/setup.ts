import { existsSync } from "node:fs";
import { join } from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import { defineCommand } from "citty";
import pc from "picocolors";

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

function printHeader() {
	console.log();
	console.log(pc.bold("openkitten setup"));
	console.log("==================");
	console.log();
}

function printFooter(hasFailed: boolean) {
	console.log();
	console.log("------------------");
	if (hasFailed) {
		console.log(
			pc.red("Some required checks failed. Fix the issues above and re-run."),
		);
	} else {
		console.log(pc.green("Ready!") + " Run `bun start` to launch the bot.");
	}
	console.log();
}

function checkBun(): boolean {
	console.log(`${OK}Bun v${Bun.version}`);
	return true;
}

async function checkOpencode(): Promise<boolean> {
	// Check if opencode is already available
	const which = Bun.which("opencode");
	if (which) {
		console.log(`${OK}opencode CLI (${pc.dim(which)})`);
		return true;
	}

	// Check node_modules/.bin directly
	const localBin = join(process.cwd(), "node_modules", ".bin", "opencode");
	if (existsSync(localBin)) {
		console.log(`${OK}opencode CLI (${pc.dim(localBin)})`);
		return true;
	}

	// Try to install opencode-ai as a project dependency
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

	// Verify after install
	const installedBin = join(process.cwd(), "node_modules", ".bin", "opencode");
	if (existsSync(installedBin)) {
		console.log(`${OK}opencode CLI (${pc.dim(installedBin)})`);
		return true;
	}

	console.log(`${ERROR}opencode CLI — installed but binary not found`);
	return false;
}

function checkTelegramEnv(): boolean {
	let ok = true;

	// TELEGRAM_BOT_TOKEN
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

	// TELEGRAM_USER_ID
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

async function checkAIProviders(opencodeAvailable: boolean): Promise<boolean> {
	if (!opencodeAvailable) {
		console.log(`${WARN}AI providers — skipped (opencode CLI not available)`);
		return false;
	}

	try {
		const { createOpencode } = await import("@opencode-ai/sdk/v2");
		const { client, server } = await createOpencode();

		try {
			const { data, error } = await client.provider.list();

			if (error || !data) {
				console.log(`${WARN}AI providers — could not query providers`);
				return false;
			}

			const connected = data.connected;
			if (connected.length > 0) {
				console.log(`${OK}AI providers: ${connected.join(", ")}`);
				return true;
			}

			console.log(`${MISSING}AI providers — no providers connected`);
			console.log(
				`          Set an API key for at least one provider (e.g. ANTHROPIC_API_KEY).`,
			);
			console.log(
				`          See ${pc.dim("https://opencode.ai/docs/providers")} for full list.`,
			);
			return false;
		} finally {
			server.close();
		}
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		console.log(`${WARN}AI providers — check failed`);
		console.log(`          ${pc.dim(msg)}`);
		return false;
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

export default defineCommand({
	meta: { description: "Check dependencies and environment setup" },
	run: async () => {
		printHeader();

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

		// 4. AI providers
		const providersOk = await checkAIProviders(opencodeOk);
		if (!providersOk && opencodeOk) hasFailed = true;

		console.log();

		// 5. Sandbox (informational, never a blocker)
		checkSandbox();

		printFooter(hasFailed);

		if (hasFailed) {
			process.exitCode = 1;
		}
	},
});
