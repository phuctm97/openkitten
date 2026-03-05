import { mkdirSync } from "node:fs";
import { unlink } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import {
	SERVICE_LAUNCHCTL_NAME,
	SERVICE_LOG_DIR,
	SERVICE_PROJECT_DIR,
	SERVICE_SYSTEMCTL_NAME,
} from "~/lib/constants/service";

// ---------------------------------------------------------------------------
// Platform detection
// ---------------------------------------------------------------------------

export function supportedPlatform(): "darwin" | "linux" | null {
	if (process.platform === "darwin") return "darwin";
	if (process.platform === "linux") return "linux";
	return null;
}

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

function plistPath(): string {
	return join(
		homedir(),
		"Library",
		"LaunchAgents",
		`${SERVICE_LAUNCHCTL_NAME}.plist`,
	);
}

function unitPath(): string {
	return join(homedir(), ".config", "systemd", "user", SERVICE_SYSTEMCTL_NAME);
}

function servicePath(): string {
	return supportedPlatform() === "darwin" ? plistPath() : unitPath();
}

// ---------------------------------------------------------------------------
// Service file generation
// ---------------------------------------------------------------------------

function bunPath(): string {
	const p = Bun.which("bun");
	if (!p) throw new Error("bun executable not found in PATH");
	return p;
}

function generatePlist(bun: string): string {
	const home = homedir();
	const pathEntries = [
		join(SERVICE_PROJECT_DIR, "node_modules", ".bin"),
		"/opt/homebrew/bin",
		join(home, ".bun", "bin"),
		"/usr/local/bin",
		"/usr/bin",
		"/bin",
	].join(":");

	return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
	<key>Label</key>
	<string>${SERVICE_LAUNCHCTL_NAME}</string>

	<key>ProgramArguments</key>
	<array>
		<string>${bun}</string>
		<string>lib/index.ts</string>
		<string>serve</string>
	</array>

	<key>WorkingDirectory</key>
	<string>${SERVICE_PROJECT_DIR}</string>

	<key>RunAtLoad</key>
	<true/>

	<key>KeepAlive</key>
	<true/>

	<key>EnvironmentVariables</key>
	<dict>
		<key>PATH</key>
		<string>${pathEntries}</string>
	</dict>

	<key>StandardOutPath</key>
	<string>${join(SERVICE_LOG_DIR, "stdout.log")}</string>

	<key>StandardErrorPath</key>
	<string>${join(SERVICE_LOG_DIR, "stderr.log")}</string>
</dict>
</plist>
`;
}

function generateUnit(bun: string): string {
	const home = homedir();
	const pathEntries = [
		join(SERVICE_PROJECT_DIR, "node_modules", ".bin"),
		join(home, ".bun", "bin"),
		"/usr/local/bin",
		"/usr/bin",
		"/bin",
	].join(":");

	return `[Unit]
Description=OpenKitten Telegram Bot
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
ExecStart=${bun} lib/index.ts serve
WorkingDirectory=${SERVICE_PROJECT_DIR}
Environment=PATH=${pathEntries}
Restart=on-failure
RestartSec=5
StandardOutput=append:${join(SERVICE_LOG_DIR, "stdout.log")}
StandardError=append:${join(SERVICE_LOG_DIR, "stderr.log")}

[Install]
WantedBy=default.target
`;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

type ServiceStatus =
	| { installed: false }
	| { installed: true; running: boolean; path: string };

export async function getServiceStatus(): Promise<ServiceStatus> {
	const platform = supportedPlatform();
	if (!platform) return { installed: false };

	const path = servicePath();
	if (!(await Bun.file(path).exists())) return { installed: false };

	const running = await isRunning(platform);
	return { installed: true, running, path };
}

async function isRunning(platform: "darwin" | "linux"): Promise<boolean> {
	try {
		if (platform === "darwin") {
			const proc = Bun.spawn(["launchctl", "list", SERVICE_LAUNCHCTL_NAME], {
				stdout: "ignore",
				stderr: "ignore",
			});
			return (await proc.exited) === 0;
		}

		const proc = Bun.spawn(
			["systemctl", "--user", "is-active", "--quiet", SERVICE_SYSTEMCTL_NAME],
			{ stdout: "ignore", stderr: "ignore" },
		);
		return (await proc.exited) === 0;
	} catch {
		return false;
	}
}

// ---------------------------------------------------------------------------
// Install
// ---------------------------------------------------------------------------

export async function installService(): Promise<
	{ ok: true; path: string } | { ok: false; reason: string }
> {
	const platform = supportedPlatform();
	if (!platform) return { ok: false, reason: "unsupported platform" };

	let bun: string;
	try {
		bun = bunPath();
	} catch (err) {
		return {
			ok: false,
			reason: err instanceof Error ? err.message : String(err),
		};
	}

	// Create log directory
	mkdirSync(SERVICE_LOG_DIR, { recursive: true });

	const path = servicePath();

	// Ensure parent directory exists
	mkdirSync(dirname(path), { recursive: true });

	// Unload/stop existing service (idempotent)
	await stopExisting(platform);

	// Write service file
	const content =
		platform === "darwin" ? generatePlist(bun) : generateUnit(bun);
	await Bun.write(path, content);

	// Load/enable+start
	const loadResult = await loadService(platform, path);
	if (!loadResult.ok) return loadResult;

	return { ok: true, path };
}

async function stopExisting(platform: "darwin" | "linux"): Promise<void> {
	try {
		if (platform === "darwin") {
			const path = plistPath();
			if (await Bun.file(path).exists()) {
				const proc = Bun.spawn(["launchctl", "unload", path], {
					stdout: "ignore",
					stderr: "ignore",
				});
				await proc.exited;
			}
		} else {
			const proc = Bun.spawn(
				["systemctl", "--user", "stop", SERVICE_SYSTEMCTL_NAME],
				{ stdout: "ignore", stderr: "ignore" },
			);
			await proc.exited;
		}
	} catch {
		// Ignore — service may not be loaded
	}
}

async function loadService(
	platform: "darwin" | "linux",
	path: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
	if (platform === "darwin") {
		const proc = Bun.spawn(["launchctl", "load", path], {
			stdout: "ignore",
			stderr: "pipe",
		});
		const code = await proc.exited;
		if (code !== 0) {
			const stderr = await new Response(proc.stderr).text();
			return {
				ok: false,
				reason: `launchctl load failed (exit ${code}): ${stderr.trim()}`,
			};
		}
		return { ok: true };
	}

	// systemd: reload daemon, then enable+start
	const reload = Bun.spawn(["systemctl", "--user", "daemon-reload"], {
		stdout: "ignore",
		stderr: "ignore",
	});
	await reload.exited;

	const proc = Bun.spawn(
		["systemctl", "--user", "enable", "--now", SERVICE_SYSTEMCTL_NAME],
		{ stdout: "ignore", stderr: "pipe" },
	);
	const code = await proc.exited;
	if (code !== 0) {
		const stderr = await new Response(proc.stderr).text();
		return {
			ok: false,
			reason: `systemctl enable --now failed (exit ${code}): ${stderr.trim()}`,
		};
	}
	return { ok: true };
}

// ---------------------------------------------------------------------------
// Uninstall (exported for future use)
// ---------------------------------------------------------------------------

export async function uninstallService(): Promise<{
	ok: boolean;
	reason?: string;
}> {
	const platform = supportedPlatform();
	if (!platform) return { ok: false, reason: "unsupported platform" };

	const path = servicePath();
	if (!(await Bun.file(path).exists())) return { ok: true }; // nothing to uninstall

	await stopExisting(platform);

	if (platform === "linux") {
		const disable = Bun.spawn(
			["systemctl", "--user", "disable", SERVICE_SYSTEMCTL_NAME],
			{ stdout: "ignore", stderr: "ignore" },
		);
		await disable.exited;
	}

	try {
		await unlink(path);
	} catch (err) {
		return {
			ok: false,
			reason: `failed to remove ${path}: ${err instanceof Error ? err.message : String(err)}`,
		};
	}

	if (platform === "linux") {
		const reload = Bun.spawn(["systemctl", "--user", "daemon-reload"], {
			stdout: "ignore",
			stderr: "ignore",
		});
		await reload.exited;
	}

	return { ok: true };
}
