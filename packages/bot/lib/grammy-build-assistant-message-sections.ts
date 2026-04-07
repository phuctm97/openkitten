import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2";
import { trimText } from "~/lib/trim-text";

type TextPart = Extract<Part, { type: "text" }>;
type FilePart = Extract<Part, { type: "file" }>;
type AgentPart = Extract<Part, { type: "agent" }>;
type ToolPart = Extract<Part, { type: "tool" }>;
type ToolMetadata = Record<string, unknown> | undefined;

interface ActionSection {
  readonly type: "action";
  readonly inlineReferences: readonly InlineReference[];
  readonly summary: ActionSummary;
}

interface ActionSummary {
  readonly changedFiles: Set<string>;
  readonly readFiles: Set<string>;
  changedActions: number;
  readActions: number;
  commandCount: number;
  delegatedTaskCount: number;
  fetchCount: number;
  loadedSkillCount: number;
  lookupCount: number;
  otherActionCount: number;
  searchCount: number;
}

interface ApplyPatchFile {
  readonly filePath?: string;
  readonly movePath?: string;
  readonly relativePath?: string;
}

interface AttachmentSection {
  readonly files: readonly FilePart[];
  readonly type: "attachment";
}

interface InlineReference {
  readonly end: number;
  readonly start: number;
  readonly value: string;
}

interface PlanEnterSection {
  readonly type: "planEnter";
}

interface PlanExitSection {
  readonly type: "planExit";
}

interface TextSection {
  readonly text: string;
  readonly type: "text";
}

type Section =
  | ActionSection
  | AttachmentSection
  | PlanEnterSection
  | PlanExitSection
  | TextSection;

const ignoredTools = new Set(["batch", "invalid", "question", "todowrite"]);

const lookupTools = new Set(["glob", "grep", "list", "lsp"]);
const searchTools = new Set(["codesearch", "websearch"]);

export function grammyBuildAssistantMessageSections(
  info: AssistantMessage,
  parts: readonly Part[],
): readonly Section[] {
  const sections: Section[] = [];
  let actionSummary = createActionSummary();
  let inlineReferences: InlineReference[] = [];
  let hasActionSection = false;
  let attachmentGroup: FilePart[] = [];
  let textGroup: string[] = [];

  function flushTextGroup() {
    if (textGroup.length === 0) return;
    sections.push({ type: "text", text: textGroup.join("\n\n") });
    textGroup = [];
  }

  function flushActionSection() {
    if (!hasActionSection) return;
    sections.push({
      type: "action",
      summary: actionSummary,
      inlineReferences,
    });
    actionSummary = createActionSummary();
    inlineReferences = [];
    hasActionSection = false;
  }

  function flushAttachmentGroup() {
    if (attachmentGroup.length === 0) return;
    sections.push({
      type: "attachment",
      files: attachmentGroup,
    });
    attachmentGroup = [];
  }

  function startActionSection() {
    flushTextGroup();
    flushAttachmentGroup();
    hasActionSection = true;
  }

  function startAttachmentSection() {
    flushTextGroup();
    flushActionSection();
  }

  for (const part of parts) {
    if (part.type === "text") {
      if (!isVisibleTextPart(part)) continue;
      flushActionSection();
      flushAttachmentGroup();
      textGroup.push(part.text);
      continue;
    }

    switch (part.type) {
      case "agent": {
        const reference = inlineReferenceFromAgent(part);
        if (!reference) continue;
        startActionSection();
        inlineReferences.push(reference);
        continue;
      }
      case "compaction":
      case "reasoning":
      case "retry":
      case "snapshot":
      case "step-finish":
      case "step-start":
      case "subtask":
        continue;
      case "file": {
        const reference = inlineReferenceFromFile(part);
        if (reference) {
          startActionSection();
          inlineReferences.push(reference);
          continue;
        }
        if (!isAttachment(part)) continue;
        startAttachmentSection();
        attachmentGroup.push(part);
        continue;
      }
      case "patch":
        startActionSection();
        addChangedPaths(actionSummary, info, part.files);
        continue;
      case "tool": {
        if (part.state.status === "pending") continue;
        if (ignoredTools.has(part.tool)) continue;
        if (part.tool === "plan_enter") {
          if (part.state.status !== "completed") continue;
          flushTextGroup();
          flushActionSection();
          flushAttachmentGroup();
          sections.push({ type: "planEnter" });
          continue;
        }
        if (part.tool === "plan_exit") {
          if (part.state.status !== "completed") continue;
          flushTextGroup();
          flushActionSection();
          flushAttachmentGroup();
          sections.push({ type: "planExit" });
          continue;
        }

        startActionSection();
        summarizeToolPart(info, part, actionSummary);

        const attachments = toolAttachments(part)
          .filter(isAttachment)
          .filter((f) => !!f.source);
        if (attachments.length === 0) continue;

        flushActionSection();
        startAttachmentSection();
        attachmentGroup.push(...attachments);
        continue;
      }
    }
  }

  flushTextGroup();
  flushActionSection();
  flushAttachmentGroup();
  return annotateTextSections(sections);
}

function createActionSummary(): ActionSummary {
  return {
    changedFiles: new Set<string>(),
    readFiles: new Set<string>(),
    changedActions: 0,
    readActions: 0,
    commandCount: 0,
    delegatedTaskCount: 0,
    fetchCount: 0,
    loadedSkillCount: 0,
    lookupCount: 0,
    otherActionCount: 0,
    searchCount: 0,
  };
}

function isVisibleTextPart(part: TextPart): boolean {
  return !part.ignored && part.text.trim().length > 0;
}

function summarizeToolPart(
  info: AssistantMessage,
  part: ToolPart,
  summary: ActionSummary,
) {
  switch (part.tool) {
    case "read":
      if (isDirectoryRead(part)) {
        summary.lookupCount += 1;
        return;
      }
      addReadPath(summary, info, stringProp(part.state.input, "filePath"));
      return;
    case "edit":
    case "multiedit":
    case "write":
      addChangedPaths(summary, info, [
        stringProp(part.state.input, "filePath"),
      ]);
      return;
    case "apply_patch":
      addChangedPaths(
        summary,
        info,
        extractApplyPatchPaths(toolMetadata(part)),
      );
      return;
    case "bash":
      summary.commandCount += 1;
      return;
    case "task":
      summary.delegatedTaskCount += 1;
      return;
    case "skill":
      summary.loadedSkillCount += 1;
      return;
    case "webfetch":
      summary.fetchCount += 1;
      return;
    default:
      if (lookupTools.has(part.tool)) {
        summary.lookupCount += 1;
        return;
      }

      if (searchTools.has(part.tool)) {
        summary.searchCount += 1;
        return;
      }

      summary.otherActionCount += 1;
  }
}

function annotateTextSections(
  sections: readonly Section[],
): readonly Section[] {
  return sections.map((section, index) => {
    if (section.type !== "text") return section;

    const actionSection = firstActionSectionBelow(sections, index + 1);
    if (!actionSection) return section;

    return {
      type: "text",
      text: underlineInlineReferences(
        section.text,
        actionSection.inlineReferences,
      ),
    };
  });
}

function firstActionSectionBelow(
  sections: readonly Section[],
  startIndex: number,
): ActionSection | undefined {
  for (const section of sections.slice(startIndex)) {
    if (section.type === "text") return undefined;
    if (section.type === "action") return section;
  }

  return undefined;
}

function underlineInlineReferences(
  text: string,
  references: readonly InlineReference[],
): string {
  if (references.length === 0) return text;

  const sortedReferences = [...references].sort(
    (left, right) => left.start - right.start,
  );

  let changed = false;
  let lastIndex = 0;
  let result = "";

  for (const reference of sortedReferences) {
    if (reference.start < lastIndex) continue;
    if (reference.start < 0 || reference.end <= reference.start) continue;
    if (reference.end > text.length) continue;

    const segment = text.slice(reference.start, reference.end);
    if (segment !== reference.value) continue;

    changed = true;
    result += text.slice(lastIndex, reference.start);
    // TODO: When Telegram Mini App support lands, upgrade these inline file
    // and agent references from underlined text to clickable links that open
    // the right Mini App surface, such as a file viewer or agent details view.
    result += `<u>${segment}</u>`;
    lastIndex = reference.end;
  }

  if (!changed) return text;
  return result + text.slice(lastIndex);
}

function inlineReferenceFromFile(file: FilePart): InlineReference | undefined {
  const sourceText = file.source?.text;
  if (!sourceText) return undefined;
  if (isAttachment(file)) return undefined;

  return {
    end: sourceText.end,
    start: sourceText.start,
    value: sourceText.value,
  };
}

function inlineReferenceFromAgent(
  part: AgentPart,
): InlineReference | undefined {
  if (!part.source) return undefined;

  return {
    end: part.source.end,
    start: part.source.start,
    value: part.source.value,
  };
}

function addReadPath(
  summary: ActionSummary,
  info: AssistantMessage,
  path: string | undefined,
) {
  const key = normalizePath(path, info.path.cwd);
  if (key) {
    summary.readFiles.add(key);
    return;
  }

  summary.readActions += 1;
}

function addChangedPaths(
  summary: ActionSummary,
  info: AssistantMessage,
  paths: readonly (string | undefined)[],
) {
  let found = false;

  for (const path of paths) {
    const key = normalizePath(path, info.path.cwd);
    if (!key) continue;
    found = true;
    summary.changedFiles.add(key);
  }

  if (!found) summary.changedActions += 1;
}

function toolMetadata(part: ToolPart): ToolMetadata {
  return "metadata" in part.state ? part.state.metadata : undefined;
}

function toolAttachments(part: ToolPart): readonly FilePart[] {
  if (part.state.status !== "completed") return [];
  return Array.isArray(part.state.attachments) ? part.state.attachments : [];
}

function isDirectoryRead(part: ToolPart): boolean {
  if (part.tool !== "read" || part.state.status !== "completed") return false;
  return part.state.output.includes("<type>directory</type>");
}

function extractApplyPatchPaths(
  metadata: ToolMetadata,
): readonly (string | undefined)[] {
  const files = metadata?.["files"];
  if (!Array.isArray(files)) return [];

  return files.map((file) => {
    if (!file || typeof file !== "object") return undefined;
    const patchFile = file as ApplyPatchFile;
    return patchFile.movePath ?? patchFile.relativePath ?? patchFile.filePath;
  });
}

function isAttachment(file: FilePart): boolean {
  return trimText(file.url)?.startsWith("data:") ?? false;
}

function normalizePath(
  path: string | undefined,
  cwd: string | undefined,
): string | undefined {
  const normalizedPath = normalizePathText(path);
  if (!normalizedPath) return undefined;

  const normalizedCwd = normalizePathText(cwd);
  if (!normalizedCwd) return normalizedPath;
  if (normalizedPath === normalizedCwd) return ".";

  for (const separator of ["/", "\\"] as const) {
    const prefix = `${normalizedCwd}${separator}`;
    if (normalizedPath.startsWith(prefix)) {
      return normalizedPath.slice(prefix.length);
    }
  }

  return normalizedPath;
}

function normalizePathText(value: string | undefined): string | undefined {
  const text = trimText(value);
  if (!text) return undefined;
  if (text.length === 1) return text;
  return text.replace(/[\\/]+$/u, "");
}

function stringProp(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const prop = value[key];
  return typeof prop === "string" ? prop : undefined;
}
