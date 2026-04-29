import { ORPCError } from "@orpc/server";
import { and, eq, isNull } from "drizzle-orm";
import { authContract } from "~/lib/auth-contract";
import { pgDatabase } from "~/lib/pg-database";
import { requireActiveHouse } from "~/lib/require-active-house";
import { requireMutatorAccess } from "~/lib/require-mutator-access";
import { notice } from "~/lib/schema/app";

export const list = authContract.notice.list.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    return await pgDatabase.query.notice.findMany({
      where: (table, { and: andOp, eq: eqOp, isNull: isNullOp }) => {
        const filters = [eqOp(table.houseId, houseId)];
        if (input?.onlyUnread) filters.push(isNullOp(table.readAt));
        return andOp(...filters);
      },
      orderBy: (table, { desc }) => desc(table.createdAt),
    });
  },
);

export const create = authContract.notice.create.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [created] = await pgDatabase
      .insert(notice)
      .values({
        id: Bun.randomUUIDv7(),
        houseId,
        kind: input.kind ?? "general",
        subject: input.subject,
        body: input.body ?? null,
        threadId: input.threadId ?? null,
        catId: input.catId ?? null,
      })
      .returning();
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create notice",
      });
    }
    return created;
  },
);

export const markRead = authContract.notice.markRead.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [updated] = await pgDatabase
      .update(notice)
      .set({ readAt: new Date() })
      .where(and(eq(notice.id, input.id), eq(notice.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Notice not found" });
    }
    return updated;
  },
);

export const markAllRead = authContract.notice.markAllRead.handler(
  async ({ context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    await pgDatabase
      .update(notice)
      .set({ readAt: new Date() })
      .where(and(eq(notice.houseId, houseId), isNull(notice.readAt)));
    return true as const;
  },
);

export const remove = authContract.notice.remove.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const deleted = await pgDatabase
      .delete(notice)
      .where(and(eq(notice.id, input.id), eq(notice.houseId, houseId)))
      .returning({ id: notice.id });
    if (deleted.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Notice not found" });
    }
    return true as const;
  },
);
