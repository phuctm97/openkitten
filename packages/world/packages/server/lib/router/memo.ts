import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { authContract } from "~/lib/auth-contract";
import { pgDatabase } from "~/lib/pg-database";
import { requireActiveHouse } from "~/lib/require-active-house";
import { requireMutatorAccess } from "~/lib/require-mutator-access";
import { memo } from "~/lib/schema/app";

export const list = authContract.memo.list.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    return await pgDatabase.query.memo.findMany({
      where: (table, { and: andOp, eq: eqOp }) => {
        const filters = [eqOp(table.houseId, houseId)];
        if (input?.targetCatId) {
          filters.push(eqOp(table.targetCatId, input.targetCatId));
        }
        return andOp(...filters);
      },
      orderBy: (table, { desc }) => [
        desc(table.pinnedAt),
        desc(table.createdAt),
      ],
    });
  },
);

export const get = authContract.memo.get.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    const found = await pgDatabase.query.memo.findFirst({
      where: (table, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(table.id, input.id), eqOp(table.houseId, houseId)),
    });
    if (!found) throw new ORPCError("NOT_FOUND", { message: "Memo not found" });
    return found;
  },
);

export const create = authContract.memo.create.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [created] = await pgDatabase
      .insert(memo)
      .values({
        id: Bun.randomUUIDv7(),
        houseId,
        authorUserId: activeUser.id,
        targetCatId: input.targetCatId ?? null,
        body: input.body,
      })
      .returning();
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create memo",
      });
    }
    return created;
  },
);

export const update = authContract.memo.update.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const { id, ...rest } = input;
    const [updated] = await pgDatabase
      .update(memo)
      .set(rest)
      .where(and(eq(memo.id, id), eq(memo.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Memo not found" });
    }
    return updated;
  },
);

export const pin = authContract.memo.pin.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [updated] = await pgDatabase
      .update(memo)
      .set({ pinnedAt: new Date() })
      .where(and(eq(memo.id, input.id), eq(memo.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Memo not found" });
    }
    return updated;
  },
);

export const unpin = authContract.memo.unpin.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [updated] = await pgDatabase
      .update(memo)
      .set({ pinnedAt: null })
      .where(and(eq(memo.id, input.id), eq(memo.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Memo not found" });
    }
    return updated;
  },
);

export const remove = authContract.memo.remove.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const deleted = await pgDatabase
      .delete(memo)
      .where(and(eq(memo.id, input.id), eq(memo.houseId, houseId)))
      .returning({ id: memo.id });
    if (deleted.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Memo not found" });
    }
    return true as const;
  },
);
