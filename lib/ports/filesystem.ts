/** File system boundary — read/write files, directories, temp dirs, URL fetching. */

export interface FileSystemPort {
	readFile(path: string): Promise<Buffer>;
	writeFile(path: string, data: Buffer | Uint8Array): Promise<void>;
	mkdir(path: string): Promise<void>;
	makeTempDir(): string;
	fetchBuffer(url: string, timeoutMs?: number): Promise<Buffer | null>;
	fileExists(path: string): Promise<boolean>;
	fileSize(path: string): Promise<number>;
	isFile(path: string): Promise<boolean>;
}
