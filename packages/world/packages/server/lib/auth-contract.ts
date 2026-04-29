import { ORPCError } from "@orpc/server";
import type { ActiveMember } from "~/lib/active-member";
import { auth } from "~/lib/auth";
import { contract } from "~/lib/contract";
import { pgDatabase } from "~/lib/pg-database";

export const authContract = contract.use(async ({ context, next }) => {
  const session = await auth.api.getSession({ headers: context.headers });
  if (!session) {
    throw new ORPCError("UNAUTHORIZED", { message: "Unauthorized" });
  }
  if (!session.user.emailVerified) {
    throw new ORPCError("UNAUTHORIZED", { message: "Email not verified" });
  }
  const headerOrganizationId =
    context.headers.get("x-active-organization-id") ?? "";
  const activeOrganizationId = headerOrganizationId || undefined;
  let activeMember: ActiveMember | undefined;
  if (activeOrganizationId) {
    const found = await pgDatabase.query.house_member.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.userId, session.user.id),
          eq(table.house_id, activeOrganizationId),
        ),
      columns: { house_id: true, role: true, createdAt: true },
      with: {
        house: {
          with: {
            workspace: { columns: { userId: true } },
          },
        },
      },
    });
    if (found) {
      if (!found.house.workspace) {
        throw new ORPCError("INTERNAL_SERVER_ERROR", {
          message: "House is missing its workspace row",
        });
      }
      activeMember = {
        organizationId: found.house_id,
        role: found.role,
        createdAt: found.createdAt,
        isPersonal: found.house.workspace.userId !== null,
      };
    }
  }
  return next({
    context: {
      activeUser: session.user,
      activeMember,
    },
  });
});
