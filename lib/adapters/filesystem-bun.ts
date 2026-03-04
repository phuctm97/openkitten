/** FileSystemPort adapter using Bun-native APIs. */

import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { nanoid } from "nanoid";
import type { FileSystemPort } from "~/lib/ports/filesystem";

const TEMP_DIR = path.join(os.tmpdir(), "openkitten-files");

export class BunFileSystemAdapter implements FileSystemPort {
	async readFile(filePath: string): Promise<Buffer> {
		const file = Bun.file(filePath);
		const arrayBuffer = await file.arrayBuffer();
		return Buffer.from(arrayBuffer);
	}

	async writeFile(filePath: string, data: Buffer | Uint8Array): Promise<void> {
		await Bun.write(filePath, data);
	}

	async mkdir(dirPath: string): Promise<void> {
		await mkdir(dirPath, { recursive: true });
	}

	makeTempDir(): string {
		const subDir = path.join(TEMP_DIR, nanoid());
		// Synchronous mkdir for simplicity — called infrequently
		const fs = require("node:fs");
		fs.mkdirSync(subDir, { recursive: true });
		return subDir;
	}

	async fetchBuffer(url: string, timeoutMs = 60_000): Promise<Buffer | null> {
		try {
			const res = await fetch(url, {
				signal: AbortSignal.timeout(timeoutMs),
			});
			if (!res.ok) return null;
			return Buffer.from(await res.arrayBuffer());
		} catch {
			return null;
		}
	}

	async fileExists(filePath: string): Promise<boolean> {
		return Bun.file(filePath).exists();
	}

	async fileSize(filePath: string): Promise<number> {
		return Bun.file(filePath).size;
	}

	async isFile(filePath: string): Promise<boolean> {
		try {
			const file = Bun.file(filePath);
			if (!(await file.exists())) return false;
			// Bun.file().size is 0 for directories, but we need to check type
			// Use stat fallback
			const fs = require("node:fs");
			const stats = fs.statSync(filePath);
			return stats.isFile();
		} catch {
			return false;
		}
	}
}
