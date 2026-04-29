import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { authContract } from "~/lib/auth-contract";
import { pgDatabase } from "~/lib/pg-database";
import { requireActiveHouse } from "~/lib/require-active-house";
import { requireMutatorAccess } from "~/lib/require-mutator-access";
import { goal } from "~/lib/schema/app";

export const list = authContract.goal.list.handler(
  async ({ context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    return await pgDatabase.query.goal.findMany({
      where: (table, { eq: eqOp }) => eqOp(table.houseId, houseId),
      orderBy: (table, { desc }) => desc(table.createdAt),
    });
  },
);

export const get = authContract.goal.get.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    const found = await pgDatabase.query.goal.findFirst({
      where: (table, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(table.id, input.id), eqOp(table.houseId, houseId)),
    });
    if (!found) throw new ORPCError("NOT_FOUND", { message: "Goal not found" });
    return found;
  },
);

export const create = authContract.goal.create.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [created] = await pgDatabase
      .insert(goal)
      .values({
        id: Bun.randomUUIDv7(),
        houseId,
        title: input.title,
        description: input.description ?? null,
        status: input.status ?? "active",
      })
      .returning();
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create goal",
      });
    }
    return created;
  },
);

export const update = authContract.goal.update.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const { id, ...rest } = input;
    const [updated] = await pgDatabase
      .update(goal)
      .set(rest)
      .where(and(eq(goal.id, id), eq(goal.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Goal not found" });
    }
    return updated;
  },
);

export const remove = authContract.goal.remove.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const deleted = await pgDatabase
      .delete(goal)
      .where(and(eq(goal.id, input.id), eq(goal.houseId, houseId)))
      .returning({ id: goal.id });
    if (deleted.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Goal not found" });
    }
    return true as const;
  },
);
