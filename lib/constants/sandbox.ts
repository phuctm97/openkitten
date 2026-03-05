import { homedir } from "node:os";
import { resolve } from "node:path";
import type { SandboxRuntimeConfig } from "@anthropic-ai/sandbox-runtime";

const home = homedir();

// Credential directories the AI agent has no reason to access
export const SANDBOX_DENY_READ: string[] = [
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

// Writable paths
export const SANDBOX_ALLOW_WRITE: string[] = [
	".",
	"/tmp",
	resolve(home, ".local/share/opencode"),
];

// Write-denied patterns (within allowWrite paths)
export const SANDBOX_DENY_WRITE: string[] = [".env*", "*.pem", "*.key"];

// Network allowlist
// AI requests always work, OpenCode always works, everything else is denied.
//
// Combines:
//   1. AI provider domains (our addition — not in Claude Code's default list)
//   2. Full Claude Code web remote default allowlist
export const SANDBOX_NETWORK_ALLOWLIST: string[] = [
	// ── AI Providers ────────────────────────────────────────────────────────
	// Anthropic
	"anthropic.com",
	"*.anthropic.com",
	// OpenAI
	"openai.com",
	"*.openai.com",
	// Google / Vertex AI
	"googleapis.com",
	"*.googleapis.com",
	// Azure OpenAI
	"*.openai.azure.com",
	"*.cognitiveservices.azure.com",
	// AWS Bedrock
	"*.amazonaws.com",
	// OpenRouter
	"openrouter.ai",
	"*.openrouter.ai",
	// Mistral
	"mistral.ai",
	"*.mistral.ai",
	// Groq
	"groq.com",
	"*.groq.com",
	// Together AI
	"together.ai",
	"*.together.ai",
	"together.xyz",
	"*.together.xyz",
	// Fireworks AI
	"fireworks.ai",
	"*.fireworks.ai",
	// Perplexity
	"perplexity.ai",
	"*.perplexity.ai",
	// Cohere
	"cohere.com",
	"*.cohere.com",
	"cohere.ai",
	"*.cohere.ai",
	// DeepSeek
	"deepseek.com",
	"*.deepseek.com",
	// xAI
	"x.ai",
	"*.x.ai",
	// Cerebras
	"cerebras.ai",
	"*.cerebras.ai",
	// SambaNova
	"sambanova.ai",
	"*.sambanova.ai",
	// AI21
	"ai21.com",
	"*.ai21.com",
	// MiniMax
	"minimax.io",
	"*.minimax.io",
	"minimaxi.com",
	"*.minimaxi.com",
	// 302.ai
	"302.ai",
	"*.302.ai",
	// Abacus AI
	"abacus.ai",
	"*.abacus.ai",
	// AIHubMix
	"aihubmix.com",
	"*.aihubmix.com",
	// Alibaba / Qwen (DashScope)
	"aliyuncs.com",
	"*.aliyuncs.com",
	// Bailing (Ant Group)
	"tbox.cn",
	"*.tbox.cn",
	// Baseten
	"baseten.co",
	"*.baseten.co",
	// Berget
	"berget.ai",
	"*.berget.ai",
	// Chutes
	"chutes.ai",
	"*.chutes.ai",
	// Cloudferro Sherlock
	"cloudferro.com",
	"*.cloudferro.com",
	// Cortecs
	"cortecs.ai",
	"*.cortecs.ai",
	// DeepInfra
	"deepinfra.com",
	"*.deepinfra.com",
	// Evroc
	"evroc.com",
	"*.evroc.com",
	// FastRouter
	"fastrouter.ai",
	"*.fastrouter.ai",
	// Firmware
	"firmware.ai",
	"*.firmware.ai",
	// Friendli
	"friendli.ai",
	"*.friendli.ai",
	// GitHub Models
	"github.ai",
	"*.github.ai",
	// Helicone
	"helicone.ai",
	"*.helicone.ai",
	// Hugging Face
	"huggingface.co",
	"*.huggingface.co",
	// iFlow
	"iflow.cn",
	"*.iflow.cn",
	// Inception
	"inceptionlabs.ai",
	"*.inceptionlabs.ai",
	// Inference.net
	"inference.net",
	"*.inference.net",
	// io.net
	"io.solutions",
	"*.io.solutions",
	// Jiekou
	"jiekou.ai",
	"*.jiekou.ai",
	// Kilo
	"kilo.ai",
	"*.kilo.ai",
	// Kimi (Moonshot coding)
	"kimi.com",
	"*.kimi.com",
	// Kuae Cloud
	"kuaecloud.net",
	"*.kuaecloud.net",
	// Meta Llama
	"llama.com",
	"*.llama.com",
	// LucidQuery
	"lucidquery.com",
	"*.lucidquery.com",
	// Meganova
	"meganova.ai",
	"*.meganova.ai",
	// Moark
	"moark.com",
	"*.moark.com",
	// ModelScope (Alibaba)
	"modelscope.cn",
	"*.modelscope.cn",
	// Moonshot AI
	"moonshot.ai",
	"*.moonshot.ai",
	"moonshot.cn",
	"*.moonshot.cn",
	// Morph
	"morphllm.com",
	"*.morphllm.com",
	// NanoGPT
	"nano-gpt.com",
	"*.nano-gpt.com",
	// Nebius
	"nebius.com",
	"*.nebius.com",
	// Amazon Nova
	"nova.amazon.com",
	"*.nova.amazon.com",
	// Novita AI
	"novita.ai",
	"*.novita.ai",
	// NVIDIA NIM
	"nvidia.com",
	"*.nvidia.com",
	// Ollama Cloud
	"ollama.com",
	"*.ollama.com",
	// OVHcloud
	"ovh.net",
	"*.ovh.net",
	// Poe
	"poe.com",
	"*.poe.com",
	// Qihang AI
	"qhaigc.net",
	"*.qhaigc.net",
	// Qiniu AI
	"qnaigc.com",
	"*.qnaigc.com",
	// Requesty
	"requesty.ai",
	"*.requesty.ai",
	// SAP AI Core
	"hana.ondemand.com",
	"*.hana.ondemand.com",
	// Scaleway
	"scaleway.ai",
	"*.scaleway.ai",
	// SiliconFlow
	"siliconflow.com",
	"*.siliconflow.com",
	"siliconflow.cn",
	"*.siliconflow.cn",
	// STACKIT
	"onstackit.cloud",
	"*.onstackit.cloud",
	// StepFun
	"stepfun.com",
	"*.stepfun.com",
	// Submodel
	"submodel.ai",
	"*.submodel.ai",
	// Synthetic
	"synthetic.new",
	"*.synthetic.new",
	// Upstage
	"upstage.ai",
	"*.upstage.ai",
	// Vercel
	"vercel.sh",
	"*.vercel.sh",
	// Venice
	"venice.ai",
	"*.venice.ai",
	// VivGrid
	"vivgrid.com",
	"*.vivgrid.com",
	// Vultr
	"vultrinference.com",
	"*.vultrinference.com",
	// Weights & Biases
	"wandb.ai",
	"*.wandb.ai",
	// Xiaomi
	"xiaomimimo.com",
	"*.xiaomimimo.com",
	// Zhipu AI (international)
	"z.ai",
	"*.z.ai",
	// Zhipu AI (China)
	"bigmodel.cn",
	"*.bigmodel.cn",
	// ZenMux
	"zenmux.ai",
	"*.zenmux.ai",

	// ── Claude Code web remote defaults ─────────────────────────────────────

	// Anthropic services (subdomains covered by *.anthropic.com above)
	"sentry.io",
	"*.sentry.io",

	// Version control
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

	// Container registries (mcr.microsoft.com covered by *.microsoft.com)
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

	// Cloud platforms
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

	// Package managers — JavaScript / Node
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

	// Package managers — Python
	"pypi.org",
	"*.pypi.org",
	"pythonhosted.org",
	"*.pythonhosted.org",
	"python.org",
	"*.python.org",

	// Package managers — Ruby
	"rubygems.org",
	"*.rubygems.org",

	// Package managers — Rust
	"crates.io",
	"*.crates.io",
	"rust-lang.org",
	"*.rust-lang.org",

	// Package managers — Go
	"golang.org",
	"*.golang.org",
	"go.dev",
	"*.go.dev",

	// Package managers — JVM
	"maven.org",
	"*.maven.org",
	"mvnrepository.com",
	"*.mvnrepository.com",
	"gradle.org",
	"*.gradle.org",

	// Package managers — PHP
	"packagist.org",
	"*.packagist.org",
	"getcomposer.org",
	"*.getcomposer.org",

	// Package managers — .NET (dotnet.microsoft.com covered by *.microsoft.com)
	"nuget.org",
	"*.nuget.org",

	// Package managers — Dart
	"pub.dev",
	"*.pub.dev",
	"dart.dev",
	"*.dart.dev",

	// Package managers — Elixir
	"hex.pm",
	"*.hex.pm",

	// Package managers — Perl
	"cpan.org",
	"*.cpan.org",
	"metacpan.org",
	"*.metacpan.org",

	// Package managers — Cocoa
	"cocoapods.org",
	"*.cocoapods.org",

	// Package managers — Haskell
	"haskell.org",
	"*.haskell.org",

	// Package managers — Swift
	"swiftpackageindex.com",
	"*.swiftpackageindex.com",
	"swift.org",
	"*.swift.org",

	// Linux distributions
	"ubuntu.com",
	"*.ubuntu.com",
	"debian.org",
	"*.debian.org",
	"archlinux.org",
	"*.archlinux.org",

	// Dev tools
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

	// Cloud services & monitoring
	"statsig.com",
	"*.statsig.com",
	"datadoghq.com",
	"*.datadoghq.com",

	// CDN & mirrors
	"sourceforge.net",
	"*.sourceforge.net",
	"packagecloud.io",
	"*.packagecloud.io",
	"cloudflare.com",
	"*.cloudflare.com",

	// Schema & config
	"json-schema.org",
	"*.json-schema.org",
	"schemastore.org",
	"*.schemastore.org",

	// MCP
	"modelcontextprotocol.io",
	"*.modelcontextprotocol.io",
];

export const SANDBOX_RUNTIME_CONFIG: SandboxRuntimeConfig = {
	filesystem: {
		denyRead: SANDBOX_DENY_READ,
		allowWrite: SANDBOX_ALLOW_WRITE,
		denyWrite: SANDBOX_DENY_WRITE,
	},
	network: {
		allowedDomains: SANDBOX_NETWORK_ALLOWLIST,
		deniedDomains: [],
		allowLocalBinding: true,
	},
};
