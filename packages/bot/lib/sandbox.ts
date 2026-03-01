import { spawn } from "node:child_process";
import { homedir } from "node:os";
import { resolve } from "node:path";
import {
	SandboxManager,
	type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";
import { createOpencodeServer } from "@opencode-ai/sdk/v2/server";

const SANDBOX_CONFIG: SandboxRuntimeConfig = {
	filesystem: {
		denyRead: [
			resolve(homedir(), ".ssh"),
			resolve(homedir(), ".aws"),
			resolve(homedir(), ".gnupg"),
			resolve(homedir(), ".config/gcloud"),
		],
		allowWrite: [".", "/tmp", resolve(homedir(), ".local/share/opencode")],
		denyWrite: [".env", ".env.local", ".env.production"],
	},
	network: {
		allowedDomains: [
			"anthropic.com",
			"*.anthropic.com",
			"openai.com",
			"*.openai.com",
			"googleapis.com",
			"*.googleapis.com",
			"openrouter.ai",
			"*.openrouter.ai",
			"registry.npmjs.org",
			"registry.yarnpkg.com",
		],
		deniedDomains: [],
		allowLocalBinding: true,
	},
};

export async function createSandboxedServer(options?: {
	port?: number;
	timeout?: number;
}): Promise<{ url: string; close: () => void }> {
	const port = options?.port ?? 4096;
	const timeout = options?.timeout ?? 5000;

	if (process.env.DANGEROUSLY_DISABLE_SANDBOX === "1") {
		console.warn("[sandbox] Sandbox disabled via DANGEROUSLY_DISABLE_SANDBOX");
		return createOpencodeServer({ port, timeout });
	}

	if (!SandboxManager.isSupportedPlatform()) {
		console.warn("[sandbox] Platform not supported, running without sandbox");
		return createOpencodeServer({ port, timeout });
	}

	const deps = SandboxManager.checkDependencies();
	if (deps.errors.length > 0) {
		console.warn(
			"[sandbox] Missing dependencies, running without sandbox:",
			deps.errors.join(", "),
		);
		return createOpencodeServer({ port, timeout });
	}

	await SandboxManager.initialize(SANDBOX_CONFIG);

	const hostname = "127.0.0.1";
	const url = `http://${hostname}:${port}`;
	const command = `opencode serve --hostname ${hostname} --port ${port}`;

	let wrappedCommand: string;
	try {
		wrappedCommand = await SandboxManager.wrapWithSandbox(command);
	} catch (error) {
		await SandboxManager.reset();
		throw error;
	}

	console.log("[sandbox] Sandbox enabled");

	const proc = spawn("sh", ["-c", wrappedCommand], {
		stdio: ["ignore", "pipe", "pipe"],
	});

	await new Promise<void>((resolve, reject) => {
		const fail = (error: Error) => {
			SandboxManager.reset().catch((err) =>
				console.error("[sandbox] Cleanup error:", err),
			);
			reject(error);
		};

		let output = "";
		let settled = false;

		const id = setTimeout(() => {
			if (settled) return;
			settled = true;
			proc.kill();
			fail(new Error(`Timeout waiting for server to start after ${timeout}ms`));
		}, timeout);

		proc.stdout.on("data", (chunk: Buffer) => {
			if (settled) return;
			output += chunk.toString();
			if (output.includes("opencode server listening")) {
				settled = true;
				clearTimeout(id);
				resolve();
			}
		});

		proc.stderr.on("data", (chunk: Buffer) => {
			if (settled) return;
			output += chunk.toString();
		});

		proc.on("exit", (code) => {
			if (settled) return;
			settled = true;
			clearTimeout(id);
			let msg = `Server exited with code ${code}`;
			if (output.trim()) {
				msg += `\nServer output: ${output}`;
			}
			fail(new Error(msg));
		});

		proc.on("error", (error) => {
			if (settled) return;
			settled = true;
			clearTimeout(id);
			fail(error);
		});
	});

	return {
		url,
		close() {
			proc.kill();
			SandboxManager.reset().catch((err) =>
				console.error("[sandbox] Cleanup error:", err),
			);
		},
	};
}
