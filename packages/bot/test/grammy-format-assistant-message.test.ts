import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2";
import { convert } from "telegram-markdown-v2";
import { assert, expect, test, vi } from "vitest";
import { grammyFormatAssistantMessage } from "~/lib/grammy-format-assistant-message";

vi.mock("telegram-markdown-v2", { spy: true });

type ToolState = Extract<Part, { type: "tool" }>["state"];
type FileSource = Extract<
  Extract<Part, { type: "file" }>["source"],
  { type: "file" }
>;
type FilePart = Extract<Part, { type: "file" }>;

interface ApplyPatchFile {
  readonly filePath?: string;
  readonly relativePath?: string;
  readonly movePath?: string;
}

interface FilePartOverrides {
  readonly filename?: string | undefined;
  readonly mime?: string;
  readonly source?: FilePart["source"];
  readonly url?: string;
}

function createInfo(
  overrides: Partial<AssistantMessage> = {},
): AssistantMessage {
  return {
    id: "m1",
    sessionID: "sess-1",
    role: "assistant",
    time: { created: 1, completed: 2 },
    parentID: "parent-1",
    modelID: "gpt-5",
    providerID: "openai",
    mode: "chat",
    agent: "default",
    path: { cwd: "/repo", root: "/repo" },
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
    ...overrides,
  };
}

function createTextPart(
  text: string,
  overrides: Partial<Extract<Part, { type: "text" }>> = {},
): Part {
  return {
    id: `text-${text}`,
    sessionID: "sess-1",
    messageID: "m1",
    type: "text",
    text,
    ...overrides,
  };
}

function createReasoningPart(text = "thinking"): Part {
  return {
    id: `reasoning-${text}`,
    sessionID: "sess-1",
    messageID: "m1",
    type: "reasoning",
    text,
    time: { start: 1, end: 2 },
  };
}

function createStepStartPart(): Part {
  return {
    id: "step-start",
    sessionID: "sess-1",
    messageID: "m1",
    type: "step-start",
  };
}

function createStepFinishPart(): Part {
  return {
    id: "step-finish",
    sessionID: "sess-1",
    messageID: "m1",
    type: "step-finish",
    reason: "stop",
    cost: 0,
    tokens: {
      input: 0,
      output: 0,
      reasoning: 0,
      cache: { read: 0, write: 0 },
    },
  };
}

function createSnapshotPart(): Part {
  return {
    id: "snapshot-1",
    sessionID: "sess-1",
    messageID: "m1",
    type: "snapshot",
    snapshot: "snap-1",
  };
}

function createRetryPart(): Part {
  return {
    id: "retry-1",
    sessionID: "sess-1",
    messageID: "m1",
    type: "retry",
    attempt: 1,
    error: { message: "retry me" } as never,
    time: { created: 1 },
  };
}

function createCompactionPart(): Part {
  return {
    id: "compaction-1",
    sessionID: "sess-1",
    messageID: "m1",
    type: "compaction",
    auto: true,
  };
}

function createAgentPart(): Part {
  return {
    id: "agent-1",
    sessionID: "sess-1",
    messageID: "m1",
    type: "agent",
    name: "planner",
  };
}

function createSubtaskPart(): Part {
  return {
    id: "subtask-1",
    sessionID: "sess-1",
    messageID: "m1",
    type: "subtask",
    prompt: "Investigate",
    description: "Investigate the bug",
    agent: "worker",
  };
}

function createFilePart(overrides: FilePartOverrides = {}): Part {
  const mime = overrides.mime ?? "text/plain";
  const filename = Object.hasOwn(overrides, "filename")
    ? overrides.filename
    : "note.txt";
  const source = overrides.source;
  const url = Object.hasOwn(overrides, "url")
    ? (overrides.url ?? "")
    : "https://example.com/note.txt";
  return {
    id: `file-${Math.random()}`,
    sessionID: "sess-1",
    messageID: "m1",
    type: "file",
    mime,
    url,
    ...(filename ? { filename } : {}),
    ...(source ? { source } : {}),
  };
}

function createToolPart(tool: string, state: ToolState): Part {
  return {
    id: `tool-${tool}-${state.status}`,
    sessionID: "sess-1",
    messageID: "m1",
    type: "tool",
    callID: `call-${tool}-${state.status}`,
    tool,
    state,
  };
}

function createCompletedToolPart(
  tool: string,
  input: Record<string, unknown> = {},
  metadata: Record<string, unknown> = {},
  attachments: readonly FilePart[] = [],
): Part {
  return createToolPart(tool, {
    status: "completed",
    input,
    output: "",
    title: `${tool} complete`,
    metadata,
    time: { start: 1, end: 2 },
    attachments: [...attachments],
  });
}

function createPendingToolPart(
  tool: string,
  input: Record<string, unknown> = {},
): Part {
  return createToolPart(tool, {
    status: "pending",
    input,
    raw: tool,
  });
}

function createPatchPart(files: readonly string[]): Part {
  return {
    id: "patch-1",
    sessionID: "sess-1",
    messageID: "m1",
    type: "patch",
    hash: "hash-1",
    files: [...files],
  };
}

function createApplyPatchFile(overrides: ApplyPatchFile): ApplyPatchFile {
  return overrides;
}

function getText(parts: ReturnType<typeof grammyFormatAssistantMessage>) {
  return parts.map((part) => part.text).join("\n");
}

test("formats assistant text with compact summaries between text sections", () => {
  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createTextPart("I checked the project."),
    createStepStartPart(),
    createReasoningPart(),
    createCompletedToolPart("read", { filePath: "/repo/src/app.ts" }),
    createCompletedToolPart("list", { path: "/repo" }),
    createCompletedToolPart("bash", { command: "bun test" }),
    createTextPart("I found the issue."),
    createCompletedToolPart("webfetch", { url: "https://example.com" }),
    createFilePart({
      filename: "report.txt",
      url: "https://example.com/report.txt",
    }),
    createTextPart("I fixed it."),
  ]);

  expect(getText(chunks)).toBe(
    [
      "I checked the project.",
      "> Read 1 file, ran 1 command, and did 1 search.",
      "I found the issue.",
      "> Fetched 1 URL and attached 1 file.",
      "I fixed it.",
    ].join("\n\n"),
  );
  assert.isDefined(chunks[0]?.markdown);
});

test("ignores internal-only parts and merges text across them", () => {
  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createTextPart("Hello"),
    createReasoningPart("thinking"),
    createStepStartPart(),
    createStepFinishPart(),
    createSnapshotPart(),
    createRetryPart(),
    createCompactionPart(),
    createPendingToolPart("question", {
      questions: [{ question: "Pick one" }],
    }),
    createCompletedToolPart("todowrite", {
      todos: [{ content: "Do a thing", status: "pending" }],
    }),
    createTextPart("world"),
  ]);

  expect(getText(chunks)).toBe("Hello\n\nworld");
});

test("summarizes recognized tool categories and unknown tools naturally", () => {
  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createCompletedToolPart("read", { filePath: "/repo/src/a.ts" }),
    createCompletedToolPart("read", { filePath: "/repo/src/a.ts" }),
    createPendingToolPart("read"),
    createCompletedToolPart("write", { filePath: "/repo/src/b.ts" }),
    createCompletedToolPart("edit", { filePath: "/repo/src/b.ts" }),
    createCompletedToolPart(
      "apply_patch",
      {},
      {
        files: [
          createApplyPatchFile({ filePath: "/repo/src/c.ts" }),
          createApplyPatchFile({ relativePath: "src/c.ts" }),
        ],
      },
    ),
    createCompletedToolPart("bash", { command: "bun test" }),
    createCompletedToolPart("list", { path: "/repo" }),
    createCompletedToolPart("glob", { pattern: "*.ts" }),
    createCompletedToolPart("grep", { pattern: "needle" }),
    createCompletedToolPart("websearch", { query: "openkitten" }),
    createCompletedToolPart("codesearch", { query: "grammy" }),
    createCompletedToolPart("webfetch", { url: "https://example.com/1" }),
    createCompletedToolPart("webfetch", { url: "https://example.com/2" }),
    createCompletedToolPart("task", { description: "delegate work" }),
    createCompletedToolPart("skill", { name: "openai-docs" }),
    createCompletedToolPart("custom_tool", { anything: true }),
  ]);

  expect(getText(chunks)).toBe(
    "> Read 2 files, edited 2 files, ran 1 command, did 5 searches, fetched 2 URLs, and did 3 other actions.",
  );
});

test("counts file parts, tool attachments, and fallback attachments", () => {
  const fileSource: FileSource = {
    type: "file",
    path: "/repo/out/result.txt",
    text: { value: "result", start: 0, end: 6 },
  };

  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createFilePart({ source: fileSource, filename: undefined }),
    createFilePart({
      filename: "named.txt",
      url: "https://example.com/named.txt",
    }),
    createFilePart({
      filename: undefined,
      url: "https://example.com/from-url.txt",
    }),
    createFilePart({ filename: undefined, url: "   " }),
    createCompletedToolPart("read", { filePath: "/repo/src/app.ts" }, {}, [
      createFilePart({
        filename: "attachment.txt",
        url: "https://example.com/attachment.txt",
      }) as Extract<Part, { type: "file" }>,
    ]),
    createAgentPart(),
    createSubtaskPart(),
  ]);

  expect(getText(chunks)).toBe(
    "> Read 1 file, attached 5 files, and did 2 other actions.",
  );
});

test("counts patch parts and normalizes unix and windows paths without double counting", () => {
  const unixChunks = grammyFormatAssistantMessage(
    createInfo({ path: { cwd: "/repo/", root: "/repo" } }),
    [
      createCompletedToolPart("edit", { filePath: "/repo/" }),
      createPatchPart(["/repo/src/a.ts", "src/a.ts", "/repo/"]),
      createCompletedToolPart(
        "apply_patch",
        {},
        {
          files: [
            createApplyPatchFile({ movePath: "/repo/src/a.ts" }),
            createApplyPatchFile({ relativePath: "src/b.ts" }),
          ],
        },
      ),
    ],
  );

  const windowsChunks = grammyFormatAssistantMessage(
    createInfo({
      path: { cwd: "C:\\repo", root: "C:\\repo" },
    }),
    [
      createCompletedToolPart("write", { filePath: "C:\\repo\\src\\main.ts" }),
      createPatchPart(["src\\main.ts", "C:\\repo\\"]),
    ],
  );

  const noCwdChunks = grammyFormatAssistantMessage(
    createInfo({ path: { cwd: "", root: "/repo" } }),
    [createCompletedToolPart("edit", { filePath: "/" })],
  );

  expect(getText(unixChunks)).toBe("> Edited 3 files.");
  expect(getText(windowsChunks)).toBe("> Edited 2 files.");
  expect(getText(noCwdChunks)).toBe("> Edited 1 file.");
});

test("falls back when read or edit paths are missing", () => {
  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createPendingToolPart("read"),
    createPendingToolPart("apply_patch"),
    createCompletedToolPart(
      "apply_patch",
      {},
      {
        files: [undefined as never],
      },
    ),
    createCompletedToolPart("edit"),
    createToolPart("read", {
      status: "completed",
      input: { filePath: "/repo/src/without-attachments.ts" },
      output: "",
      title: "read complete",
      metadata: {},
      time: { start: 1, end: 2 },
    } as never),
  ]);

  expect(getText(chunks)).toBe("> Read 2 files and edited 3 files.");
});

test("uses a one-item summary when only a single category is present", () => {
  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createCompletedToolPart("custom_tool"),
  ]);

  expect(getText(chunks)).toBe("> Did 1 other action.");
});

test("ignores empty and ignored text parts", () => {
  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createTextPart("   "),
    createTextPart("Shown"),
    createTextPart("Hidden", { ignored: true }),
  ]);

  expect(getText(chunks)).toBe("Shown");
});

test("returns no chunks when nothing user-visible remains", () => {
  expect(
    grammyFormatAssistantMessage(createInfo(), [
      createReasoningPart(),
      createStepStartPart(),
      createRetryPart(),
      createPendingToolPart("question"),
    ]),
  ).toEqual([]);
});

test("falls back to plain text when Markdown conversion fails", () => {
  vi.mocked(convert).mockImplementationOnce(() => {
    throw new Error("conversion failed");
  });

  const chunks = grammyFormatAssistantMessage(createInfo(), [
    createTextPart("Hello"),
    createCompletedToolPart("bash", { command: "bun test" }),
  ]);

  expect(chunks.length).toBeGreaterThan(0);
  expect(chunks[0]?.markdown).toBeUndefined();
  expect(getText(chunks)).toContain("Hello");
  expect(getText(chunks)).toContain("Ran 1 command");
});
