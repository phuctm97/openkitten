import type { AssistantMessage, Part } from "@opencode-ai/sdk/v2";
import { grammyFormatText } from "~/lib/grammy-format-text";

type TextPart = Extract<Part, { type: "text" }>;
type FilePart = Extract<Part, { type: "file" }>;
type ToolPart = Extract<Part, { type: "tool" }>;
type ToolMetadata = Record<string, unknown> | undefined;

interface Summary {
  readonly readFiles: Set<string>;
  readonly editedFiles: Set<string>;
  readonly attachedFiles: Set<string>;
  readActions: number;
  editActions: number;
  attachmentActions: number;
  commandCount: number;
  searchCount: number;
  fetchCount: number;
  otherActionCount: number;
}

interface ApplyPatchFile {
  readonly filePath?: string;
  readonly relativePath?: string;
  readonly movePath?: string;
}

const ignoredTools = new Set(["question", "todowrite"]);

export function grammyFormatAssistantMessage(
  info: AssistantMessage,
  parts: readonly Part[],
) {
  const sections: string[] = [];
  let textGroup: string[] = [];
  let summary = createSummary();
  let hasSummary = false;

  function flushTextGroup() {
    if (textGroup.length === 0) return;
    const text = textGroup.join("\n\n").trim();
    sections.push(text);
    textGroup = [];
  }

  function flushSummary() {
    if (!hasSummary) return;
    sections.push(formatSummary(summary));
    summary = createSummary();
    hasSummary = false;
  }

  for (const part of parts) {
    if (isVisibleTextPart(part)) {
      flushSummary();
      textGroup.push(part.text.trim());
      continue;
    }

    if (!summarizePart(info, part, summary)) continue;
    flushTextGroup();
    hasSummary = true;
  }

  flushTextGroup();
  flushSummary();
  return grammyFormatText(sections.join("\n\n"));
}

function createSummary(): Summary {
  return {
    readFiles: new Set<string>(),
    editedFiles: new Set<string>(),
    attachedFiles: new Set<string>(),
    readActions: 0,
    editActions: 0,
    attachmentActions: 0,
    commandCount: 0,
    searchCount: 0,
    fetchCount: 0,
    otherActionCount: 0,
  };
}

function isVisibleTextPart(part: Part): part is TextPart {
  return part.type === "text" && !part.ignored && part.text.trim().length > 0;
}

function summarizePart(
  info: AssistantMessage,
  part: Part,
  summary: Summary,
): boolean {
  switch (part.type) {
    case "text":
      return false;
    case "reasoning":
    case "step-start":
    case "step-finish":
    case "snapshot":
    case "retry":
    case "compaction":
      return false;
    case "file":
      addAttachment(summary, part);
      return true;
    case "patch":
      addEditedPaths(summary, info, part.files);
      return true;
    case "agent":
    case "subtask":
      summary.otherActionCount += 1;
      return true;
    case "tool":
      return summarizeToolPart(info, part, summary);
  }
}

function summarizeToolPart(
  info: AssistantMessage,
  part: ToolPart,
  summary: Summary,
): boolean {
  if (ignoredTools.has(part.tool)) return false;

  switch (part.tool) {
    case "read":
      addReadPath(summary, info, stringProp(part.state.input, "filePath"));
      break;
    case "edit":
    case "write":
      addEditedPaths(summary, info, [stringProp(part.state.input, "filePath")]);
      break;
    case "apply_patch":
      addEditedPaths(summary, info, extractApplyPatchPaths(toolMetadata(part)));
      break;
    case "bash":
      summary.commandCount += 1;
      break;
    case "list":
    case "glob":
    case "grep":
    case "websearch":
    case "codesearch":
      summary.searchCount += 1;
      break;
    case "webfetch":
      summary.fetchCount += 1;
      break;
    case "task":
    case "skill":
      summary.otherActionCount += 1;
      break;
    default:
      summary.otherActionCount += 1;
      break;
  }

  const attachments = toolAttachments(part);
  for (const attachment of attachments) addAttachment(summary, attachment);
  return true;
}

function addReadPath(
  summary: Summary,
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

function addEditedPaths(
  summary: Summary,
  info: AssistantMessage,
  paths: readonly (string | undefined)[],
) {
  let found = false;

  for (const path of paths) {
    const key = normalizePath(path, info.path.cwd);
    if (!key) continue;
    found = true;
    summary.editedFiles.add(key);
  }

  if (!found) summary.editActions += 1;
}

function addAttachment(summary: Summary, file: FilePart) {
  const key = attachmentKey(file);
  if (key) {
    summary.attachedFiles.add(key);
    return;
  }
  summary.attachmentActions += 1;
}

function toolMetadata(part: ToolPart): ToolMetadata {
  return "metadata" in part.state ? part.state.metadata : undefined;
}

function toolAttachments(part: ToolPart): readonly FilePart[] {
  if (part.state.status !== "completed") return [];
  return Array.isArray(part.state.attachments) ? part.state.attachments : [];
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

function formatSummary(summary: Summary): string {
  const phrases = [
    countPhrase(summary.readFiles.size + summary.readActions, "read", "file"),
    countPhrase(
      summary.editedFiles.size + summary.editActions,
      "edited",
      "file",
    ),
    countPhrase(summary.commandCount, "ran", "command"),
    countPhrase(summary.searchCount, "did", "search"),
    urlPhrase(summary.fetchCount),
    countPhrase(
      summary.attachedFiles.size + summary.attachmentActions,
      "attached",
      "file",
    ),
    otherActionPhrase(summary.otherActionCount),
  ].filter((phrase): phrase is string => !!phrase);
  return `> ${capitalize(joinNatural(phrases))}.`;
}

function countPhrase(
  count: number,
  verb: "attached" | "did" | "edited" | "ran" | "read",
  noun: "command" | "file" | "search",
): string | undefined {
  if (count === 0) return undefined;

  if (verb === "did") {
    return `did ${count} ${pluralize(noun, count)}`;
  }

  return `${verb} ${count} ${pluralize(noun, count)}`;
}

function urlPhrase(count: number): string | undefined {
  if (count === 0) return undefined;
  return `fetched ${count} ${count === 1 ? "URL" : "URLs"}`;
}

function otherActionPhrase(count: number): string | undefined {
  if (count === 0) return undefined;
  return `did ${count} other ${pluralize("action", count)}`;
}

function joinNatural(parts: readonly string[]): string {
  if (parts.length <= 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts.slice(-1).join("")}`;
}

function attachmentKey(file: FilePart): string | undefined {
  const source = file.source;
  if (source && "path" in source) return cleanText(source.path);
  return cleanText(file.filename) ?? cleanText(file.url);
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
  const text = cleanText(value);
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

function cleanText(value: string | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  if (word === "search") return "searches";
  return `${word}s`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
