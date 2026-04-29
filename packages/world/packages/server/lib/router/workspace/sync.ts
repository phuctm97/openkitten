import { ORPCError } from "@orpc/server";
import { authContract } from "~/lib/auth-contract";
import { syncWorkspace } from "~/lib/sync-workspace";
import { WorkspaceNotFoundError } from "~/lib/workspace-not-found-error";

export const sync = authContract.workspace.sync.handler(
  async ({ context: { activeUser, activeMember } }) => {
    try {
      return await syncWorkspace(
        activeMember
          ? {
              user: activeUser,
              activeOrganizationId: activeMember.organizationId,
            }
          : { user: activeUser },
      );
    } catch (error) {
      if (error instanceof WorkspaceNotFoundError) {
        throw new ORPCError("NOT_FOUND", { message: "Workspace not found" });
      }
      throw error;
    }
  },
);
