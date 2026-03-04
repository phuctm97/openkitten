/**
 * Unified subprocess spawner for OpenCode server.
 * Both sandbox and non-sandbox paths use Bun.spawn() with dynamic port allocation.
 * Parses the actual URL from stdout.
 */

import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import {
	SandboxManager,
	type SandboxRuntimeConfig,
} from "@anthropic-ai/sandbox-runtime";

const home = homedir();

// ── Credential directories the AI agent has no reason to access ──────────────

const DENY_READ: string[] = [
	resolve(home, ".ssh"),
	resolve(home, ".aws"),
	resolve(home, ".azure"),
	resolve(home, ".config/gcloud"),
	resolve(home, ".docker"),
	resolve(home, ".kube"),
	resolve(home, ".gnupg"),
	resolve(home, ".npmrc"),
	resolve(home, ".yarnrc"),
	resolve(home, ".netrc"),
	resolve(home, ".config/gh"),
	resolve(home, ".config/op"),
];

// ── Writable paths ──────────────────────────────────────────────────────────

const ALLOW_WRITE: string[] = [
	".",
	"/tmp",
	resolve(home, ".local/share/opencode"),
];

// ── Write-denied patterns (within allowWrite paths) ─────────────────────────

const DENY_WRITE: string[] = [".env*", "*.pem", "*.key"];

// ── Network allowlist ───────────────────────────────────────────────────────

const ALLOWED_DOMAINS: string[] = [
	// ── AI Providers ────────────────────────────────────────────────────────
	"anthropic.com",
	"*.anthropic.com",
	"openai.com",
	"*.openai.com",
	"googleapis.com",
	"*.googleapis.com",
	"*.openai.azure.com",
	"*.cognitiveservices.azure.com",
	"*.amazonaws.com",
	"openrouter.ai",
	"*.openrouter.ai",
	"mistral.ai",
	"*.mistral.ai",
	"groq.com",
	"*.groq.com",
	"together.ai",
	"*.together.ai",
	"together.xyz",
	"*.together.xyz",
	"fireworks.ai",
	"*.fireworks.ai",
	"perplexity.ai",
	"*.perplexity.ai",
	"cohere.com",
	"*.cohere.com",
	"cohere.ai",
	"*.cohere.ai",
	"deepseek.com",
	"*.deepseek.com",
	"x.ai",
	"*.x.ai",
	"cerebras.ai",
	"*.cerebras.ai",
	"sambanova.ai",
	"*.sambanova.ai",
	"ai21.com",
	"*.ai21.com",
	"minimax.io",
	"*.minimax.io",
	"minimaxi.com",
	"*.minimaxi.com",
	"302.ai",
	"*.302.ai",
	"abacus.ai",
	"*.abacus.ai",
	"aihubmix.com",
	"*.aihubmix.com",
	"aliyuncs.com",
	"*.aliyuncs.com",
	"tbox.cn",
	"*.tbox.cn",
	"baseten.co",
	"*.baseten.co",
	"berget.ai",
	"*.berget.ai",
	"chutes.ai",
	"*.chutes.ai",
	"cloudferro.com",
	"*.cloudferro.com",
	"cortecs.ai",
	"*.cortecs.ai",
	"deepinfra.com",
	"*.deepinfra.com",
	"evroc.com",
	"*.evroc.com",
	"fastrouter.ai",
	"*.fastrouter.ai",
	"firmware.ai",
	"*.firmware.ai",
	"friendli.ai",
	"*.friendli.ai",
	"github.ai",
	"*.github.ai",
	"helicone.ai",
	"*.helicone.ai",
	"huggingface.co",
	"*.huggingface.co",
	"iflow.cn",
	"*.iflow.cn",
	"inceptionlabs.ai",
	"*.inceptionlabs.ai",
	"inference.net",
	"*.inference.net",
	"io.solutions",
	"*.io.solutions",
	"jiekou.ai",
	"*.jiekou.ai",
	"kilo.ai",
	"*.kilo.ai",
	"kimi.com",
	"*.kimi.com",
	"kuaecloud.net",
	"*.kuaecloud.net",
	"llama.com",
	"*.llama.com",
	"lucidquery.com",
	"*.lucidquery.com",
	"meganova.ai",
	"*.meganova.ai",
	"moark.com",
	"*.moark.com",
	"modelscope.cn",
	"*.modelscope.cn",
	"moonshot.ai",
	"*.moonshot.ai",
	"moonshot.cn",
	"*.moonshot.cn",
	"morphllm.com",
	"*.morphllm.com",
	"nano-gpt.com",
	"*.nano-gpt.com",
	"nebius.com",
	"*.nebius.com",
	"nova.amazon.com",
	"*.nova.amazon.com",
	"novita.ai",
	"*.novita.ai",
	"nvidia.com",
	"*.nvidia.com",
	"ollama.com",
	"*.ollama.com",
	"ovh.net",
	"*.ovh.net",
	"poe.com",
	"*.poe.com",
	"qhaigc.net",
	"*.qhaigc.net",
	"qnaigc.com",
	"*.qnaigc.com",
	"requesty.ai",
	"*.requesty.ai",
	"hana.ondemand.com",
	"*.hana.ondemand.com",
	"scaleway.ai",
	"*.scaleway.ai",
	"siliconflow.com",
	"*.siliconflow.com",
	"siliconflow.cn",
	"*.siliconflow.cn",
	"onstackit.cloud",
	"*.onstackit.cloud",
	"stepfun.com",
	"*.stepfun.com",
	"submodel.ai",
	"*.submodel.ai",
	"synthetic.new",
	"*.synthetic.new",
	"upstage.ai",
	"*.upstage.ai",
	"vercel.sh",
	"*.vercel.sh",
	"venice.ai",
	"*.venice.ai",
	"vivgrid.com",
	"*.vivgrid.com",
	"vultrinference.com",
	"*.vultrinference.com",
	"wandb.ai",
	"*.wandb.ai",
	"xiaomimimo.com",
	"*.xiaomimimo.com",
	"z.ai",
	"*.z.ai",
	"bigmodel.cn",
	"*.bigmodel.cn",
	"zenmux.ai",
	"*.zenmux.ai",

	// ── Claude Code web remote defaults ─────────────────────────────────────
	"sentry.io",
	"*.sentry.io",
	"github.com",
	"*.github.com",
	"github.io",
	"*.github.io",
	"githubusercontent.com",
	"*.githubusercontent.com",
	"gitlab.com",
	"*.gitlab.com",
	"bitbucket.org",
	"*.bitbucket.org",
	"docker.io",
	"*.docker.io",
	"docker.com",
	"*.docker.com",
	"gcr.io",
	"*.gcr.io",
	"ghcr.io",
	"*.ghcr.io",
	"*.mcr.microsoft.com",
	"*.ecr.aws",
	"cloud.google.com",
	"*.cloud.google.com",
	"azure.com",
	"*.azure.com",
	"microsoft.com",
	"*.microsoft.com",
	"oracle.com",
	"*.oracle.com",
	"java.com",
	"*.java.com",
	"registry.npmjs.org",
	"npmjs.com",
	"*.npmjs.com",
	"yarnpkg.com",
	"*.yarnpkg.com",
	"unpkg.com",
	"*.unpkg.com",
	"jsdelivr.net",
	"*.jsdelivr.net",
	"esm.sh",
	"*.esm.sh",
	"pypi.org",
	"*.pypi.org",
	"pythonhosted.org",
	"*.pythonhosted.org",
	"python.org",
	"*.python.org",
	"rubygems.org",
	"*.rubygems.org",
	"crates.io",
	"*.crates.io",
	"rust-lang.org",
	"*.rust-lang.org",
	"golang.org",
	"*.golang.org",
	"go.dev",
	"*.go.dev",
	"maven.org",
	"*.maven.org",
	"mvnrepository.com",
	"*.mvnrepository.com",
	"gradle.org",
	"*.gradle.org",
	"packagist.org",
	"*.packagist.org",
	"getcomposer.org",
	"*.getcomposer.org",
	"nuget.org",
	"*.nuget.org",
	"pub.dev",
	"*.pub.dev",
	"dart.dev",
	"*.dart.dev",
	"hex.pm",
	"*.hex.pm",
	"cpan.org",
	"*.cpan.org",
	"metacpan.org",
	"*.metacpan.org",
	"cocoapods.org",
	"*.cocoapods.org",
	"haskell.org",
	"*.haskell.org",
	"swiftpackageindex.com",
	"*.swiftpackageindex.com",
	"swift.org",
	"*.swift.org",
	"ubuntu.com",
	"*.ubuntu.com",
	"debian.org",
	"*.debian.org",
	"archlinux.org",
	"*.archlinux.org",
	"kubernetes.io",
	"*.kubernetes.io",
	"hashicorp.com",
	"*.hashicorp.com",
	"anaconda.com",
	"*.anaconda.com",
	"anaconda.org",
	"*.anaconda.org",
	"apache.org",
	"*.apache.org",
	"eclipse.org",
	"*.eclipse.org",
	"nodejs.org",
	"*.nodejs.org",
	"bun.sh",
	"*.bun.sh",
	"deno.land",
	"*.deno.land",
	"statsig.com",
	"*.statsig.com",
	"datadoghq.com",
	"*.datadoghq.com",
	"sourceforge.net",
	"*.sourceforge.net",
	"packagecloud.io",
	"*.packagecloud.io",
	"cloudflare.com",
	"*.cloudflare.com",
	"json-schema.org",
	"*.json-schema.org",
	"schemastore.org",
	"*.schemastore.org",
	"modelcontextprotocol.io",
	"*.modelcontextprotocol.io",
];

// ── Resolve opencode binary ─────────────────────────────────────────────────

function resolveOpencodeBin(): string {
	const fromPath = Bun.which("opencode");
	if (fromPath) return fromPath;

	const local = join(
		resolve(import.meta.dirname, ".."),
		"node_modules",
		".bin",
		"opencode",
	);
	if (existsSync(local)) return local;

	throw new Error(
		"opencode executable not found. Ensure the opencode-ai package is installed.",
	);
}

// ── Sandbox configuration ───────────────────────────────────────────────────

const SANDBOX_CONFIG: SandboxRuntimeConfig = {
	filesystem: {
		denyRead: DENY_READ,
		allowWrite: ALLOW_WRITE,
		denyWrite: DENY_WRITE,
	},
	network: {
		allowedDomains: ALLOWED_DOMAINS,
		deniedDomains: [],
		allowLocalBinding: true,
	},
};

// ── Parse URL from stdout ───────────────────────────────────────────────────

const LISTENING_PATTERN = /opencode server listening on (https?:\/\/[^\s]+)/;

function parseServerUrl(output: string): string | null {
	const match = output.match(LISTENING_PATTERN);
	return match?.[1] ?? null;
}

// ── Spawn OpenCode subprocess ───────────────────────────────────────────────

export interface ServerHandle {
	url: string;
	sandboxed: boolean;
	kill(): void;
}

export async function spawnOpencodeServer(options?: {
	timeout?: number;
}): Promise<ServerHandle> {
	const timeout = options?.timeout ?? 10000;
	const hostname = "127.0.0.1";

	const opencodeBin = resolveOpencodeBin();

	// Determine sandbox mode
	const useSandbox = await shouldUseSandbox();

	let command: string[];
	let cleanup: (() => Promise<void>) | null = null;

	if (useSandbox) {
		await SandboxManager.initialize(SANDBOX_CONFIG);
		cleanup = async () => {
			await SandboxManager.reset().catch((err) =>
				console.error("[sandbox] Cleanup error:", err),
			);
		};

		const baseCommand = `'${opencodeBin.replace(/'/g, "'\\''")}' serve --hostname ${hostname}`;
		let wrappedCommand: string;
		try {
			wrappedCommand = await SandboxManager.wrapWithSandbox(baseCommand);
		} catch (error) {
			await SandboxManager.reset();
			throw error;
		}
		command = ["sh", "-c", wrappedCommand];
		console.log("[sandbox] Sandbox enabled");
	} else {
		command = [opencodeBin, "serve", "--hostname", hostname];
	}

	const proc = Bun.spawn(command, {
		stdio: ["ignore", "pipe", "pipe"],
	});

	const url = await new Promise<string>((resolve, reject) => {
		let output = "";
		let settled = false;

		const fail = (error: Error) => {
			if (cleanup)
				cleanup().catch((err) =>
					console.error("[sandbox] Cleanup error:", err),
				);
			reject(error);
		};

		const id = setTimeout(() => {
			if (settled) return;
			settled = true;
			proc.kill();
			fail(new Error(`Timeout waiting for server to start after ${timeout}ms`));
		}, timeout);

		const reader = proc.stdout.getReader();
		const decoder = new TextDecoder();

		(async () => {
			try {
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;
					if (settled) break;

					output += decoder.decode(value, { stream: true });
					const serverUrl = parseServerUrl(output);
					if (serverUrl) {
						settled = true;
						clearTimeout(id);
						resolve(serverUrl);
						break;
					}
				}
			} catch {
				// Reader cancelled
			}

			if (!settled) {
				settled = true;
				clearTimeout(id);
				fail(new Error(`Server exited without URL.\nOutput: ${output}`));
			}
		})();

		// Capture stderr
		const stderrReader = proc.stderr.getReader();
		(async () => {
			try {
				while (true) {
					const { done, value } = await stderrReader.read();
					if (done) break;
					if (settled) break;
					output += decoder.decode(value, { stream: true });
				}
			} catch {
				// Reader cancelled
			}
		})();
	});

	return {
		url,
		sandboxed: useSandbox,
		kill() {
			proc.kill();
			if (cleanup)
				cleanup().catch((err) =>
					console.error("[sandbox] Cleanup error:", err),
				);
		},
	};
}

async function shouldUseSandbox(): Promise<boolean> {
	if (process.env.DANGEROUSLY_DISABLE_SANDBOX === "1") {
		console.warn(
			"*** SANDBOX DISABLED *** Sandbox bypassed via DANGEROUSLY_DISABLE_SANDBOX",
		);
		return false;
	}

	if (!SandboxManager.isSupportedPlatform()) {
		console.warn(
			"*** SANDBOX UNAVAILABLE *** Platform not supported, running without sandbox",
		);
		return false;
	}

	const deps = SandboxManager.checkDependencies();
	if (deps.errors.length > 0) {
		console.warn(
			"*** SANDBOX UNAVAILABLE *** Missing dependencies, running without sandbox:",
			deps.errors.join(", "),
		);
		return false;
	}

	return true;
}
