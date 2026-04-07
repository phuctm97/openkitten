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

test("writes file to .openkitten/{fileId}/{filename}", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write(
    "file-abc",
    "test.pdf",
    "application/pdf",
    data,
  );

  expect(path).toContain(".openkitten");
  expect(path).toContain("file-abc");
  expect(path).toContain("test.pdf");
  const content = await readFile(path);
  expect(new Uint8Array(content)).toEqual(data);
});

test("uses fileId as directory name", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1]);

  const path1 = await storage.write("id-1", "file.txt", "text/plain", data);
  const path2 = await storage.write("id-2", "file.txt", "text/plain", data);

  expect(path1).not.toBe(path2);
  expect(path1).toContain("id-1");
  expect(path2).toContain("id-2");
});

test("creates directory structure if it does not exist", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write(
    "file-xyz",
    "doc.zip",
    "application/zip",
    data,
  );

  expect(path).toContain(join(workspace, ".openkitten"));
  const content = await readFile(path);
  expect(new Uint8Array(content)).toEqual(data);
});

test("sanitizes path traversal in filename", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write(
    "file-safe",
    "../../etc/passwd",
    "application/octet-stream",
    data,
  );

  expect(path).toContain(join(workspace, ".openkitten"));
  expect(path).not.toContain("etc");
  expect(path).toContain("passwd");
  const content = await readFile(path);
  expect(new Uint8Array(content)).toEqual(data);
});

test("handles empty filename with mime extension", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write("file-empty", "", "image/jpeg", data);

  expect(path).toContain("attachment");
  expect(path).toContain(".jpg");
});

test("uses .bin extension for unknown mime", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write(
    "file-unknown",
    "",
    "application/x-unknown",
    data,
  );

  expect(path).toContain(".bin");
});

test("does not duplicate extension when filename already has it", async () => {
  const storage = AttachmentStorage.create(workspace);
  const data = new Uint8Array([1, 2, 3]);

  const path = await storage.write(
    "file-photo",
    "photo.jpg",
    "image/jpeg",
    data,
  );

  expect(path).toContain("photo.jpg");
  expect(path).not.toContain("photo.jpg.jpg");
});
