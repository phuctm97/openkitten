import { pgDatabase } from "~/lib/pg-database";

export async function isPersonalHouse(houseId: string): Promise<boolean> {
  const ws = await pgDatabase.query.workspace.findFirst({
    where: (table, { eq }) => eq(table.houseId, houseId),
    columns: { userId: true },
  });
  if (!ws) return false;
  return ws.userId !== null;
}
