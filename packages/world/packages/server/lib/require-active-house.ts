import { ORPCError } from "@orpc/server";
import type { ActiveMember } from "~/lib/active-member";
import { pgDatabase } from "~/lib/pg-database";

export async function requireActiveHouse(
  userId: string,
  activeMember: ActiveMember | undefined,
): Promise<string> {
  if (activeMember) return activeMember.organizationId;
  const personal = await pgDatabase.query.workspace.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
    columns: { houseId: true },
  });
  if (personal) return personal.houseId;
  const firstMember = await pgDatabase.query.house_member.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
    columns: { house_id: true },
    orderBy: (table, { asc }) => asc(table.createdAt),
  });
  if (firstMember) return firstMember.house_id;
  throw new ORPCError("FORBIDDEN", {
    message: "No house available for this user",
  });
}
