import { ORPCError } from "@orpc/server";
import { eq } from "drizzle-orm";
import { authContract } from "~/lib/auth-contract";
import { pgDatabase } from "~/lib/pg-database";
import { requireActiveHouse } from "~/lib/require-active-house";
import { requireMutatorAccess } from "~/lib/require-mutator-access";
import { comment, thread } from "~/lib/schema/app";

async function loadHouseScopedThread(threadId: string, houseId: string) {
  const found = await pgDatabase.query.thread.findFirst({
    where: (table, { and: andOp, eq: eqOp }) =>
      andOp(eqOp(table.id, threadId), eqOp(table.houseId, houseId)),
    columns: { id: true },
  });
  if (!found) throw new ORPCError("NOT_FOUND", { message: "Thread not found" });
  return found;
}

export const listByThread = authContract.comment.listByThread.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    await loadHouseScopedThread(input.threadId, houseId);
    return await pgDatabase.query.comment.findMany({
      where: (table, { eq: eqOp }) => eqOp(table.threadId, input.threadId),
      orderBy: (table, { asc }) => asc(table.createdAt),
    });
  },
);

export const create = authContract.comment.create.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    await loadHouseScopedThread(input.threadId, houseId);
    const [created] = await pgDatabase
      .insert(comment)
      .values({
        id: Bun.randomUUIDv7(),
        threadId: input.threadId,
        authorUserId: activeUser.id,
        authorCatId: null,
        body: input.body,
      })
      .returning();
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create comment",
      });
    }
    await pgDatabase
      .update(thread)
      .set({ updatedAt: new Date() })
      .where(eq(thread.id, input.threadId));
    return created;
  },
);

export const remove = authContract.comment.remove.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const found = await pgDatabase.query.comment.findFirst({
      where: (table, { eq: eqOp }) => eqOp(table.id, input.id),
      with: {
        thread: { columns: { houseId: true } },
      },
    });
    if (!found || found.thread.houseId !== houseId) {
      throw new ORPCError("NOT_FOUND", { message: "Comment not found" });
    }
    await pgDatabase.delete(comment).where(eq(comment.id, input.id));
    return true as const;
  },
);
