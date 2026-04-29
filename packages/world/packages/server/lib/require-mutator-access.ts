import { ORPCError } from "@orpc/server";
import type { ActiveMember } from "~/lib/active-member";
import { pgDatabase } from "~/lib/pg-database";

function isMutatorRole(role: string): boolean {
  return role === "owner" || role === "admin";
}

export async function requireMutatorAccess(
  userId: string,
  activeMember: ActiveMember | undefined,
): Promise<string> {
  if (activeMember) {
    if (!isMutatorRole(activeMember.role)) {
      throw new ORPCError("FORBIDDEN", {
        message: "Only owners and admins can change this house",
      });
    }
    return activeMember.organizationId;
  }
  const personal = await pgDatabase.query.workspace.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
    columns: { houseId: true },
  });
  if (personal) {
    const personalMember = await pgDatabase.query.house_member.findFirst({
      where: (table, { and, eq }) =>
        and(eq(table.userId, userId), eq(table.house_id, personal.houseId)),
      columns: { role: true },
    });
    if (!personalMember || !isMutatorRole(personalMember.role)) {
      throw new ORPCError("FORBIDDEN", {
        message: "Only owners and admins can change this house",
      });
    }
    return personal.houseId;
  }
  const firstMember = await pgDatabase.query.house_member.findFirst({
    where: (table, { eq }) => eq(table.userId, userId),
    columns: { house_id: true, role: true },
    orderBy: (table, { asc }) => asc(table.createdAt),
  });
  if (!firstMember) {
    throw new ORPCError("FORBIDDEN", {
      message: "No house available for this user",
    });
  }
  if (!isMutatorRole(firstMember.role)) {
    throw new ORPCError("FORBIDDEN", {
      message: "Only owners and admins can change this house",
    });
  }
  return firstMember.house_id;
}
