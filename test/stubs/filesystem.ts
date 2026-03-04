import type { FileSystemPort } from "~/lib/ports/filesystem";

export function createFileSystemStub(): FileSystemPort & {
	files: Map<string, Buffer>;
	fetchResults: Map<string, Buffer | null>;
	tempDirCounter: number;
} {
	const files = new Map<string, Buffer>();
	const fetchResults = new Map<string, Buffer | null>();
	let tempDirCounter = 0;

	return {
		files,
		fetchResults,
		get tempDirCounter() {
			return tempDirCounter;
		},
		set tempDirCounter(v: number) {
			tempDirCounter = v;
		},

		async readFile(path: string): Promise<Buffer> {
			const data = files.get(path);
			if (!data) throw new Error(`ENOENT: ${path}`);
			return data;
		},

		async writeFile(path: string, data: Buffer | Uint8Array): Promise<void> {
			files.set(path, Buffer.from(data));
		},

		async mkdir(_path: string): Promise<void> {
			// no-op in memory
		},

		makeTempDir(): string {
			return `/tmp/openkitten-stub-${tempDirCounter++}`;
		},

		async fetchBuffer(url: string): Promise<Buffer | null> {
			const result = fetchResults.get(url);
			if (result !== undefined) return result;
			return Buffer.from("stub-fetch-content");
		},

		async fileExists(path: string): Promise<boolean> {
			return files.has(path);
		},

		async fileSize(path: string): Promise<number> {
			const data = files.get(path);
			if (!data) throw new Error(`ENOENT: ${path}`);
			return data.length;
		},

		async isFile(path: string): Promise<boolean> {
			return files.has(path);
		},
	};
}
