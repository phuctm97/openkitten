import { pgDatabase } from "~/lib/pg-database";
import { WorkspaceNotFoundError } from "~/lib/workspace-not-found-error";

export async function isPersonalHouse(houseId: string): Promise<boolean> {
  const ws = await pgDatabase.query.workspace.findFirst({
    where: (table, { eq }) => eq(table.houseId, houseId),
    columns: { userId: true },
  });
  if (!ws) throw new WorkspaceNotFoundError("workspace-missing");
  return ws.userId !== null;
}
