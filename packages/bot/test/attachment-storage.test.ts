import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, test } from "vitest";
import { AttachmentStorage } from "~/lib/attachment-storage";

let workspace: string;

beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), "attachment-storage-"));
});

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true });
});

test("writes file to .attachments directory", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write("test.pdf", data);

  expect(path).toContain(".attachments");
  expect(path).toContain("test.pdf");
  const content = await readFile(path);
  expect(new Uint8Array(content)).toEqual(data);
});

test("generates unique filenames", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1]);

  const path1 = await storage.write("file.txt", data);
  const path2 = await storage.write("file.txt", data);

  expect(path1).not.toBe(path2);
});

test("creates .attachments directory if it does not exist", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write("doc.zip", data);

  expect(path).toContain(join(workspace, ".attachments"));
  const content = await readFile(path);
  expect(new Uint8Array(content)).toEqual(data);
});

test("sanitizes path traversal in filename", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write("../../etc/passwd", data);

  expect(path).toContain(join(workspace, ".attachments"));
  expect(path).not.toContain("etc");
  expect(path).toContain("passwd");
  const content = await readFile(path);
  expect(new Uint8Array(content)).toEqual(data);
});

test("handles empty filename", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write("", data);

  expect(path).toContain(join(workspace, ".attachments"));
  expect(path).toContain("attachment");
});
