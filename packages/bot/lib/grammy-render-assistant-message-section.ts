import type { grammyBuildAssistantMessageSections } from "~/lib/grammy-build-assistant-message-sections";

type AssistantMessageSection = ReturnType<
  typeof grammyBuildAssistantMessageSections
>[number];
type ActionSummary = Extract<
  ReturnType<typeof grammyBuildAssistantMessageSections>[number],
  { type: "action" }
>["summary"];

export function grammyRenderAssistantMessageSection(
  section: AssistantMessageSection,
): string | undefined {
  switch (section.type) {
    case "action":
      return hasActionSummary(section.summary)
        ? formatActionSummary(section.summary)
        : undefined;
    case "attachment":
      return undefined;
    case "planEnter":
      return "🎯 _Entered plan mode._";
    case "planExit":
      return "🚪 _Exited plan mode._";
    case "text":
      return section.text.trim();
  }
}

function formatActionSummary(summary: ActionSummary): string {
  const hasNamedActions =
    summary.changedFiles.size > 0 ||
    summary.readFiles.size > 0 ||
    summary.changedActions > 0 ||
    summary.readActions > 0 ||
    summary.commandCount > 0 ||
    summary.delegatedTaskCount > 0 ||
    summary.fetchCount > 0 ||
    summary.loadedSkillCount > 0 ||
    summary.lookupCount > 0 ||
    summary.searchCount > 0;
  const parts = [
    countPhrase(summary.readFiles.size + summary.readActions, "read", "file"),
    countPhrase(
      summary.changedFiles.size + summary.changedActions,
      "changed",
      "file",
    ),
    countPhrase(summary.commandCount, "ran", "command"),
    countPhrase(summary.lookupCount, "made", "lookup"),
    countPhrase(summary.searchCount, "did", "search"),
    urlPhrase(summary.fetchCount),
    countPhrase(summary.delegatedTaskCount, "delegated", "task"),
    countPhrase(summary.loadedSkillCount, "loaded", "skill"),
    otherActionPhrase(summary.otherActionCount, hasNamedActions),
  ].filter((part): part is string => !!part);
  return `🛠️ _${capitalize(joinNatural(parts))}._`;
}

function hasActionSummary(summary: ActionSummary): boolean {
  return (
    summary.changedFiles.size > 0 ||
    summary.readFiles.size > 0 ||
    summary.changedActions > 0 ||
    summary.readActions > 0 ||
    summary.commandCount > 0 ||
    summary.delegatedTaskCount > 0 ||
    summary.fetchCount > 0 ||
    summary.loadedSkillCount > 0 ||
    summary.lookupCount > 0 ||
    summary.otherActionCount > 0 ||
    summary.searchCount > 0
  );
}

function countPhrase(
  count: number,
  verb: "changed" | "delegated" | "did" | "loaded" | "made" | "ran" | "read",
  noun: "command" | "file" | "lookup" | "search" | "skill" | "task",
): string | undefined {
  if (count === 0) return undefined;
  return `${verb} ${count} ${pluralize(noun, count)}`;
}

function urlPhrase(count: number): string | undefined {
  if (count === 0) return undefined;
  return `fetched ${count} ${count === 1 ? "URL" : "URLs"}`;
}

function otherActionPhrase(
  count: number,
  hasNamedActions: boolean,
): string | undefined {
  if (count === 0) return undefined;
  if (!hasNamedActions)
    return `performed ${count} ${pluralize("action", count)}`;
  return `performed ${count} other ${pluralize("action", count)}`;
}

function joinNatural(parts: readonly string[]): string {
  if (parts.length <= 2) return parts.join(" and ");
  return `${parts.slice(0, -1).join(", ")}, and ${parts.slice(-1).join("")}`;
}

function pluralize(word: string, count: number): string {
  if (count === 1) return word;
  if (word === "search") return "searches";
  return `${word}s`;
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
