import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2";
import { expect, test } from "vitest";
import { grammyBuildAssistantMessageSections } from "~/lib/grammy-build-assistant-message-sections";
import { grammyRenderAssistantMessageSection } from "~/lib/grammy-render-assistant-message-section";

type ToolState = Extract<Part, { type: "tool" }>["state"];
type FilePart = Extract<Part, { type: "file" }>;
type FileSource = Extract<
  Extract<Part, { type: "file" }>["source"],
  { type: "file" }
>;

interface ApplyPatchFile {
  readonly filePath?: string;
  readonly movePath?: string;
  readonly relativePath?: string;
}

interface FilePartOverrides {
  readonly filename?: string | undefined;
  readonly mime?: string;
  readonly source?: FilePart["source"];
  readonly url?: string;
}

const textAttachmentUrl = "data:text/plain;base64,SGVsbG8=";

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

function createAgentPart(
  overrides: Partial<Extract<Part, { type: "agent" }>> = {},
): Part {
  return {
    id: "agent-1",
    sessionID: "sess-1",
    messageID: "m1",
    type: "agent",
    name: "planner",
    ...overrides,
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
  output = "",
): Part {
  return createToolPart(tool, {
    status: "completed",
    input,
    output,
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

function createRunningToolPart(
  tool: string,
  input: Record<string, unknown> = {},
  metadata: Record<string, unknown> = {},
): Part {
  return createToolPart(tool, {
    status: "running",
    input,
    metadata,
    time: { start: 1 },
    title: `${tool} running`,
  });
}

function createErrorToolPart(
  tool: string,
  input: Record<string, unknown> = {},
): Part {
  return createToolPart(tool, {
    status: "error",
    error: `${tool} failed`,
    input,
    time: { start: 1, end: 2 },
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

function renderSections(info: AssistantMessage, parts: readonly Part[]) {
  return grammyBuildAssistantMessageSections(info, parts)
    .map(grammyRenderAssistantMessageSection)
    .filter((section): section is string => !!section);
}

function getText(info: AssistantMessage, parts: readonly Part[]) {
  return renderSections(info, parts).join("\n\n");
}

test("renders standalone plan-exit sections in order", () => {
  expect(
    getText(createInfo(), [
      createTextPart("I checked the project."),
      createStepStartPart(),
      createReasoningPart(),
      createCompletedToolPart("read", { filePath: "/repo/src/app.ts" }),
      createCompletedToolPart("list", { path: "/repo" }),
      createCompletedToolPart("bash", { command: "bun test" }),
      createCompletedToolPart("webfetch", { url: "https://example.com/guide" }),
      createCompletedToolPart("plan_exit"),
      createCompletedToolPart("task", {
        description: "Explore components",
        subagent_type: "explore",
      }),
      createTextPart("I fixed it."),
    ]),
  ).toBe(
    [
      "I checked the project.",
      "🛠️ _Read 1 file, ran 1 command, made 1 lookup, and fetched 1 URL._",
      "🚪 _Exited plan mode._",
      "🛠️ _Delegated 1 task._",
      "I fixed it.",
    ].join("\n\n"),
  );
});

test("renders standalone plan-enter sections in order", () => {
  expect(
    getText(createInfo(), [
      createTextPart("I can help plan this."),
      createCompletedToolPart("plan_enter"),
      createCompletedToolPart("task", {
        description: "Research the codebase",
        subagent_type: "explore",
      }),
      createTextPart("I have a plan ready."),
    ]),
  ).toBe(
    [
      "I can help plan this.",
      "🎯 _Entered plan mode._",
      "🛠️ _Delegated 1 task._",
      "I have a plan ready.",
    ].join("\n\n"),
  );
});

test("counts folder reads in the lookup bucket", () => {
  expect(
    getText(createInfo(), [
      createCompletedToolPart(
        "read",
        { filePath: "/repo/docs" },
        {},
        [],
        [
          "<path>/repo/docs</path>",
          "<type>directory</type>",
          "<entries>",
          "guide.md",
          "(1 entries)",
          "</entries>",
        ].join("\n"),
      ),
      createCompletedToolPart("read", { filePath: "/repo/README.md" }),
    ]),
  ).toBe("🛠️ _Read 1 file and made 1 lookup._");
});

test("underlines inline file references from the first later action section", () => {
  const readmeSource: FileSource = {
    type: "file",
    path: "/repo/README.md",
    text: { value: "@README.md", start: 5, end: 15 },
  };
  const appSource: FileSource = {
    type: "file",
    path: "/repo/src/app.ts",
    text: { value: "@src/app.ts", start: 20, end: 31 },
  };

  expect(
    getText(createInfo(), [
      createTextPart("Open @README.md and @src/app.ts."),
      createCompletedToolPart("plan_exit"),
      createFilePart({
        source: appSource,
        url: "file:///repo/src/app.ts",
        filename: "src/app.ts",
      }),
      createFilePart({
        source: readmeSource,
        url: "file:///repo/README.md",
        filename: "README.md",
      }),
      createCompletedToolPart("read", { filePath: "/repo/README.md" }),
      createTextPart("Done."),
    ]),
  ).toBe(
    [
      "Open <u>@README.md</u> and <u>@src/app.ts</u>.",
      "🚪 _Exited plan mode._",
      "🛠️ _Read 1 file._",
      "Done.",
    ].join("\n\n"),
  );
});

test("underlines inline agent references from the first later action section", () => {
  expect(
    getText(createInfo(), [
      createTextPart("Ask @planner for a plan."),
      createAgentPart({
        id: "agent-inline",
        source: { value: "@planner", start: 4, end: 12 },
      }),
      createCompletedToolPart("task", {
        description: "Plan the work",
        subagent_type: "planner",
      }),
    ]),
  ).toBe(
    ["Ask <u>@planner</u> for a plan.", "🛠️ _Delegated 1 task._"].join("\n\n"),
  );
});

test("treats multiedit as a changed-file action", () => {
  expect(
    getText(createInfo(), [
      createCompletedToolPart("multiedit", { filePath: "/repo/src/app.ts" }),
    ]),
  ).toBe("🛠️ _Changed 1 file._");
});

test("only applies inline references to the nearest earlier text section", () => {
  const fileSource: FileSource = {
    type: "file",
    path: "/repo/README.md",
    text: { value: "@README.md", start: 7, end: 17 },
  };

  expect(
    getText(createInfo(), [
      createTextPart("First @README.md mention."),
      createCompletedToolPart("plan_exit"),
      createTextPart("Second @README.md mention."),
      createFilePart({
        source: fileSource,
        url: "file:///repo/README.md",
        filename: "README.md",
      }),
      createCompletedToolPart("read", { filePath: "/repo/README.md" }),
    ]),
  ).toBe(
    [
      "First @README.md mention.",
      "🚪 _Exited plan mode._",
      "Second <u>@README.md</u> mention.",
      "🛠️ _Read 1 file._",
    ].join("\n\n"),
  );
});

test("ignores invalid and overlapping inline references", () => {
  expect(
    getText(createInfo(), [
      createTextPart("Open @README.md."),
      createFilePart({
        source: {
          type: "file",
          path: "/repo/README.md",
          text: { value: "Op", start: -1, end: 1 },
        },
        url: "file:///repo/README.md",
        filename: "README.md",
      }),
      createFilePart({
        source: {
          type: "file",
          path: "/repo/README.md",
          text: { value: "", start: 3, end: 3 },
        },
        url: "file:///repo/README.md",
        filename: "README.md",
      }),
      createFilePart({
        source: {
          type: "file",
          path: "/repo/README.md",
          text: { value: "Nope", start: 0, end: 4 },
        },
        url: "file:///repo/README.md",
        filename: "README.md",
      }),
      createFilePart({
        source: {
          type: "file",
          path: "/repo/README.md",
          text: { value: "@README.md", start: 5, end: 15 },
        },
        url: "file:///repo/README.md",
        filename: "README.md",
      }),
      createFilePart({
        source: {
          type: "file",
          path: "/repo/README.md",
          text: { value: "READ", start: 6, end: 10 },
        },
        url: "file:///repo/README.md",
        filename: "README.md",
      }),
      createCompletedToolPart("read", { filePath: "/repo/README.md" }),
    ]),
  ).toBe(["Open <u>@README.md</u>.", "🛠️ _Read 1 file._"].join("\n\n"));
});

test("ignores internal-only parts and merges text across them", () => {
  const fileSource: FileSource = {
    type: "file",
    path: "/repo/README.md",
    text: { value: "@README.md", start: 0, end: 10 },
  };

  expect(
    getText(createInfo(), [
      createTextPart("Hello"),
      createReasoningPart("thinking"),
      createStepStartPart(),
      createStepFinishPart(),
      createSnapshotPart(),
      createRetryPart(),
      createCompactionPart(),
      createAgentPart(),
      createSubtaskPart(),
      createPendingToolPart("question", {
        questions: [{ question: "Pick one" }],
      }),
      createCompletedToolPart("todowrite", {
        todos: [{ content: "Do a thing", status: "pending" }],
      }),
      createCompletedToolPart("invalid", {
        tool: "bash",
        error: "bad params",
      }),
      createCompletedToolPart("batch", {
        tool_calls: [
          { tool: "read", parameters: { filePath: "/repo/src/app.ts" } },
        ],
      }),
      createRunningToolPart("plan_exit"),
      createFilePart({
        source: fileSource,
        url: "file:///repo/README.md",
        filename: undefined,
      }),
      createTextPart("world"),
    ]),
  ).toBe("Hello\n\nworld");
});

test("summarizes recognized categories and unknown tools naturally", () => {
  expect(
    getText(createInfo(), [
      createCompletedToolPart("read", { filePath: "/repo/src/a.ts" }),
      createRunningToolPart("read", { filePath: "/repo/src/a.ts" }),
      createPendingToolPart("read", { filePath: "/repo/src/pending.ts" }),
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
      createCompletedToolPart("lsp", {
        operation: "goToDefinition",
        filePath: "src/app.ts",
        line: 1,
        character: 1,
      }),
      createCompletedToolPart("websearch", { query: "openkitten" }),
      createCompletedToolPart("codesearch", { query: "grammy" }),
      createCompletedToolPart("webfetch", { url: "https://example.com/1" }),
      createCompletedToolPart("webfetch", { url: "https://example.com/2" }),
      createCompletedToolPart("task", {
        description: "delegate work",
        subagent_type: "explore",
      }),
      createErrorToolPart("task", {
        description: "retry delegate",
        subagent_type: "plan",
      }),
      createCompletedToolPart("skill", { name: "openai-docs" }),
      createCompletedToolPart("custom_tool", { anything: true }),
    ]),
  ).toBe(
    "🛠️ _Read 1 file, changed 2 files, ran 1 command, made 4 lookups, did 2 searches, fetched 2 URLs, delegated 2 tasks, loaded 1 skill, and performed 1 other action._",
  );
});

test("omits attachment summaries once files are sent separately", () => {
  const fileSource: FileSource = {
    type: "file",
    path: "/repo/out/result.txt",
    text: { value: "result", start: 0, end: 6 },
  };

  expect(
    getText(createInfo(), [
      createFilePart({
        source: fileSource,
        url: textAttachmentUrl,
        filename: undefined,
      }),
      createFilePart({
        filename: undefined,
        url: "data:text/plain;base64,RGF0YQ==",
      }),
      createFilePart({
        source: fileSource,
        url: "file:///repo/out/result.txt",
        filename: undefined,
      }),
      createFilePart({
        filename: "named.txt",
        url: "https://example.com/named.txt",
      }),
      createFilePart({ filename: undefined, url: "   " }),
      createCompletedToolPart("read", { filePath: "/repo/src/app.ts" }, {}, [
        createFilePart({
          source: fileSource,
          filename: "attachment.txt",
          url: "data:text/plain;base64,V29ybGQ=",
        }) as Extract<Part, { type: "file" }>,
      ]),
      createCompletedToolPart("custom_tool", {}, {}, [
        createFilePart({
          filename: undefined,
          url: "https://example.com/archive.txt",
        }) as Extract<Part, { type: "file" }>,
        createFilePart({
          source: fileSource,
          filename: "archive.txt",
          url: "data:text/plain;base64,QXJjaGl2ZQ==",
        }) as Extract<Part, { type: "file" }>,
      ]),
    ]),
  ).toBe(["🛠️ _Read 1 file._", "🛠️ _Performed 1 action._"].join("\n\n"));
});

test("counts patch parts and normalizes unix and windows paths without double counting", () => {
  expect(
    getText(createInfo({ path: { cwd: "/repo/", root: "/repo" } }), [
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
    ]),
  ).toBe("🛠️ _Changed 3 files._");
  expect(
    getText(
      createInfo({
        path: { cwd: "C:\\repo", root: "C:\\repo" },
      }),
      [
        createCompletedToolPart("write", {
          filePath: "C:\\repo\\src\\main.ts",
        }),
        createPatchPart(["src\\main.ts", "C:\\repo\\"]),
      ],
    ),
  ).toBe("🛠️ _Changed 2 files._");
  expect(
    getText(createInfo({ path: { cwd: "", root: "/repo" } }), [
      createCompletedToolPart("edit", { filePath: "/" }),
    ]),
  ).toBe("🛠️ _Changed 1 file._");
});

test("ignores pending tools and falls back when paths are missing", () => {
  expect(
    getText(createInfo(), [
      createPendingToolPart("read"),
      createPendingToolPart("apply_patch"),
      createErrorToolPart("apply_patch"),
      createCompletedToolPart(
        "apply_patch",
        {},
        {
          files: [undefined as never],
        },
      ),
      createErrorToolPart("edit"),
      createCompletedToolPart("read"),
      createToolPart("read", {
        status: "completed",
        input: { filePath: "/repo/src/without-attachments.ts" },
        output: "",
        title: "read complete",
        metadata: {},
        time: { start: 1, end: 2 },
      } as never),
    ]),
  ).toBe("🛠️ _Read 2 files and changed 3 files._");
});

test("ignores the batch wrapper and counts emitted child tool parts", () => {
  expect(
    getText(createInfo(), [
      createTextPart("Started."),
      createCompletedToolPart("batch", {
        tool_calls: [
          { tool: "read", parameters: { filePath: "/repo/src/a.ts" } },
          { tool: "bash", parameters: { command: "bun test" } },
        ],
      }),
      createCompletedToolPart("read", { filePath: "/repo/src/a.ts" }),
      createCompletedToolPart("bash", { command: "bun test" }),
      createTextPart("Done."),
    ]),
  ).toBe(
    ["Started.", "🛠️ _Read 1 file and ran 1 command._", "Done."].join("\n\n"),
  );
});

test("uses one-item sections for plan entries exits and fallback summaries", () => {
  expect(getText(createInfo(), [createCompletedToolPart("plan_enter")])).toBe(
    "🎯 _Entered plan mode._",
  );
  expect(getText(createInfo(), [createCompletedToolPart("plan_exit")])).toBe(
    "🚪 _Exited plan mode._",
  );
  expect(getText(createInfo(), [createCompletedToolPart("custom_tool")])).toBe(
    "🛠️ _Performed 1 action._",
  );
});

test("ignores non-completed plan-enter tool parts", () => {
  expect(
    renderSections(createInfo(), [
      createRunningToolPart("plan_enter"),
      createErrorToolPart("plan_enter"),
    ]),
  ).toEqual([]);
});

test("ignores empty and ignored text parts", () => {
  expect(
    getText(createInfo(), [
      createTextPart("   "),
      createTextPart("Shown"),
      createTextPart("Hidden", { ignored: true }),
    ]),
  ).toBe("Shown");
});

test("returns no rendered sections when nothing user-visible remains", () => {
  const fileSource: FileSource = {
    type: "file",
    path: "/repo/README.md",
    text: { value: "@README.md", start: 0, end: 10 },
  };

  expect(
    renderSections(createInfo(), [
      createReasoningPart(),
      createStepStartPart(),
      createRetryPart(),
      createPendingToolPart("question"),
      createAgentPart(),
      createSubtaskPart(),
      createCompletedToolPart("batch"),
      createFilePart({
        source: fileSource,
        filename: undefined,
        url: "file:///repo/README.md",
      }),
    ]),
  ).toEqual([]);
});
