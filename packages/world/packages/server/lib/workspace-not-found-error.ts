export class WorkspaceNotFoundError extends Error {
  readonly reason:
    | "house-missing"
    | "workspace-missing"
    | "membership-missing"
    | "auto-create-failed";

  constructor(
    reason:
      | "house-missing"
      | "workspace-missing"
      | "membership-missing"
      | "auto-create-failed" = "house-missing",
  ) {
    super(`Failed to find workspace: ${reason}`);
    this.reason = reason;
  }
}
