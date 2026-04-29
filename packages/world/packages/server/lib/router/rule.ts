import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { authContract } from "~/lib/auth-contract";
import { pgDatabase } from "~/lib/pg-database";
import { requireActiveHouse } from "~/lib/require-active-house";
import { requireMutatorAccess } from "~/lib/require-mutator-access";
import { rule } from "~/lib/schema/app";

export const list = authContract.rule.list.handler(
  async ({ context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    return await pgDatabase.query.rule.findMany({
      where: (table, { eq: eqOp }) => eqOp(table.houseId, houseId),
      orderBy: (table, { asc }) => asc(table.createdAt),
    });
  },
);

export const get = authContract.rule.get.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    const found = await pgDatabase.query.rule.findFirst({
      where: (table, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(table.id, input.id), eqOp(table.houseId, houseId)),
    });
    if (!found) throw new ORPCError("NOT_FOUND", { message: "Rule not found" });
    return found;
  },
);

export const create = authContract.rule.create.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const [created] = await pgDatabase
      .insert(rule)
      .values({
        id: Bun.randomUUIDv7(),
        houseId,
        title: input.title,
        body: input.body,
        enabled: input.enabled ?? true,
      })
      .returning();
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create rule",
      });
    }
    return created;
  },
);

export const update = authContract.rule.update.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const { id, ...rest } = input;
    const [updated] = await pgDatabase
      .update(rule)
      .set(rest)
      .where(and(eq(rule.id, id), eq(rule.houseId, houseId)))
      .returning();
    if (!updated) {
      throw new ORPCError("NOT_FOUND", { message: "Rule not found" });
    }
    return updated;
  },
);

export const remove = authContract.rule.remove.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const deleted = await pgDatabase
      .delete(rule)
      .where(and(eq(rule.id, input.id), eq(rule.houseId, houseId)))
      .returning({ id: rule.id });
    if (deleted.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Rule not found" });
    }
    return true as const;
  },
);
