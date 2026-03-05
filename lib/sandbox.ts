import { join, resolve } from "node:path";
import { SandboxManager } from "@anthropic-ai/sandbox-runtime";
import { SANDBOX_RUNTIME_CONFIG } from "~/lib/constants/sandbox";

// ── Resolve opencode binary ─────────────────────────────────────────────────

async function resolveOpencodeBin(): Promise<string> {
	const fromPath = Bun.which("opencode");
	if (fromPath) return fromPath;

	const local = join(
		resolve(import.meta.dirname, ".."),
		"node_modules",
		".bin",
		"opencode",
	);
	if (await Bun.file(local).exists()) return local;

	throw new Error(
		"opencode executable not found. Ensure the opencode-ai package is installed.",
	);
}

// ── Wait for subprocess server ready ────────────────────────────────────────

function waitForServerReady(
	proc: {
		stdout: ReadableStream<Uint8Array>;
		stderr: ReadableStream<Uint8Array>;
		kill(): void;
		exited: Promise<number>;
	},
	timeout: number,
	onFail?: () => Promise<void>,
): Promise<string> {
	return new Promise<string>((resolve, reject) => {
		const fail = (error: Error) => {
			if (onFail) {
				onFail().catch((err) => console.error("[sandbox] Cleanup error:", err));
			}
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

		(async () => {
			const decoder = new TextDecoder();
			const reader = proc.stdout.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (settled) continue;
					output += decoder.decode(value, { stream: true });
					const match = output.match(
						/opencode server listening on (https?:\/\/\S+)/,
					);
					if (match?.[1]) {
						settled = true;
						clearTimeout(id);
						resolve(match[1]);
					}
				}
			} catch {
				// Stream closed
			} finally {
				reader.releaseLock();
			}
		})();

		(async () => {
			const decoder = new TextDecoder();
			const reader = proc.stderr.getReader();
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (!settled) {
						output += decoder.decode(value, { stream: true });
					}
				}
			} catch {
				// Stream closed
			} finally {
				reader.releaseLock();
			}
		})();

		proc.exited.then((code) => {
			if (settled) return;
			settled = true;
			clearTimeout(id);
			let msg = `Server exited with code ${code}`;
			if (output.trim()) {
				msg += `\nServer output: ${output}`;
			}
			fail(new Error(msg));
		});
	});
}

// ── Spawn unsandboxed opencode subprocess ───────────────────────────────────

async function spawnOpencodeServer(options?: {
	timeout?: number;
}): Promise<{ url: string; close: () => void }> {
	const timeout = options?.timeout ?? 5000;
	const opencodeBin = await resolveOpencodeBin();

	const proc = Bun.spawn([opencodeBin, "serve", "--hostname", "127.0.0.1"], {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});

	const url = await waitForServerReady(proc, timeout);

	return {
		url,
		close() {
			proc.kill();
		},
	};
}

// ── Sandbox configuration ───────────────────────────────────────────────────

export async function createSandboxedServer(options?: {
	timeout?: number;
}): Promise<{ url: string; close: () => void; sandboxed: boolean }> {
	const timeout = options?.timeout ?? 5000;

	if (process.env.DANGEROUSLY_DISABLE_SANDBOX === "1") {
		console.warn(
			"*** SANDBOX DISABLED *** Sandbox bypassed via DANGEROUSLY_DISABLE_SANDBOX",
		);
		const server = await spawnOpencodeServer({ timeout });
		return { ...server, sandboxed: false };
	}

	if (!SandboxManager.isSupportedPlatform()) {
		console.warn(
			"*** SANDBOX UNAVAILABLE *** Platform not supported, running without sandbox",
		);
		const server = await spawnOpencodeServer({ timeout });
		return { ...server, sandboxed: false };
	}

	const deps = SandboxManager.checkDependencies();
	if (deps.errors.length > 0) {
		console.warn(
			"*** SANDBOX UNAVAILABLE *** Missing dependencies, running without sandbox:",
			deps.errors.join(", "),
		);
		const server = await spawnOpencodeServer({ timeout });
		return { ...server, sandboxed: false };
	}

	await SandboxManager.initialize(SANDBOX_RUNTIME_CONFIG);

	let opencodeBin: string;
	try {
		opencodeBin = await resolveOpencodeBin();
	} catch (error) {
		await SandboxManager.reset();
		throw error;
	}

	const command = `'${opencodeBin.replace(/'/g, "'\\''")}' serve --hostname 127.0.0.1`;

	let wrappedCommand: string;
	try {
		wrappedCommand = await SandboxManager.wrapWithSandbox(command);
	} catch (error) {
		await SandboxManager.reset();
		throw error;
	}

	console.log("[sandbox] Sandbox enabled");

	const proc = Bun.spawn(["sh", "-c", wrappedCommand], {
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});

	const url = await waitForServerReady(proc, timeout, () =>
		SandboxManager.reset(),
	);

	return {
		url,
		close() {
			proc.kill();
			SandboxManager.reset().catch((err) =>
				console.error("[sandbox] Cleanup error:", err),
			);
		},
		sandboxed: true,
	};
}
