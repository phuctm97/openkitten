import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { authContract } from "~/lib/auth-contract";
import { pgDatabase } from "~/lib/pg-database";
import { requireActiveHouse } from "~/lib/require-active-house";
import { requireMutatorAccess } from "~/lib/require-mutator-access";
import { thread } from "~/lib/schema/app";

export const list = authContract.thread.list.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    return await pgDatabase.query.thread.findMany({
      where: (table, { and: andOp, eq: eqOp }) => {
        const filters = [eqOp(table.houseId, houseId)];
        if (input?.status) filters.push(eqOp(table.status, input.status));
        if (input?.assignedCatId) {
          filters.push(eqOp(table.assignedCatId, input.assignedCatId));
        }
        if (input?.goalId) filters.push(eqOp(table.goalId, input.goalId));
        return andOp(...filters);
      },
      orderBy: (table, { desc }) => desc(table.updatedAt),
    });
  },
);

export const get = authContract.thread.get.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    const found = await pgDatabase.query.thread.findFirst({
      where: (table, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(table.id, input.id), eqOp(table.houseId, houseId)),
    });
    if (!found) {
      throw new ORPCError("NOT_FOUND", { message: "Thread not found" });
    }
    return found;
  },
);

export const create = authContract.thread.create.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [created] = await pgDatabase
      .insert(thread)
      .values({
        id: Bun.randomUUIDv7(),
        houseId,
        title: input.title,
        summary: input.summary ?? null,
        assignedCatId: input.assignedCatId ?? null,
        goalId: input.goalId ?? null,
      })
      .returning();
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create thread",
      });
    }
    return created;
  },
);

export const update = authContract.thread.update.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const { id, ...rest } = input;
    const [updated] = await pgDatabase
      .update(thread)
      .set(rest)
      .where(and(eq(thread.id, id), eq(thread.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Thread not found" });
    }
    return updated;
  },
);

export const close = authContract.thread.close.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [updated] = await pgDatabase
      .update(thread)
      .set({ status: "closed", closedAt: new Date() })
      .where(and(eq(thread.id, input.id), eq(thread.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Thread not found" });
    }
    return updated;
  },
);

export const reopen = authContract.thread.reopen.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [updated] = await pgDatabase
      .update(thread)
      .set({ status: "open", closedAt: null })
      .where(and(eq(thread.id, input.id), eq(thread.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Thread not found" });
    }
    return updated;
  },
);

export const remove = authContract.thread.remove.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const deleted = await pgDatabase
      .delete(thread)
      .where(and(eq(thread.id, input.id), eq(thread.houseId, houseId)))
      .returning({ id: thread.id });
    if (deleted.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Thread not found" });
    }
    return true as const;
  },
);
