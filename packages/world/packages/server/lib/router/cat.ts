import { ORPCError } from "@orpc/server";
import { and, eq } from "drizzle-orm";
import { authContract } from "~/lib/auth-contract";
import { generateCatSlug } from "~/lib/generate-cat-slug";
import { pgDatabase } from "~/lib/pg-database";
import { requireActiveHouse } from "~/lib/require-active-house";
import { requireMutatorAccess } from "~/lib/require-mutator-access";
import { cat } from "~/lib/schema/app";

export const list = authContract.cat.list.handler(
  async ({ context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    return await pgDatabase.query.cat.findMany({
      where: (table, { eq: eqOp }) => eqOp(table.houseId, houseId),
      orderBy: (table, { asc }) => asc(table.createdAt),
    });
  },
);

export const get = authContract.cat.get.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireActiveHouse(activeUser.id, activeMember);
    const found = await pgDatabase.query.cat.findFirst({
      where: (table, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(table.id, input.id), eqOp(table.houseId, houseId)),
    });
    if (!found) throw new ORPCError("NOT_FOUND", { message: "Cat not found" });
    return found;
  },
);

export const create = authContract.cat.create.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const id = Bun.randomUUIDv7();
    const slug = generateCatSlug(input.name);
    const [created] = await pgDatabase
      .insert(cat)
      .values({
        id,
        houseId,
        name: input.name,
        slug,
        description: input.description ?? null,
        avatar: input.avatar ?? null,
        mood: input.mood ?? "awake",
      })
      .returning();
    if (!created) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", {
        message: "Failed to create cat",
      });
    }
    return created;
  },
);

export const update = authContract.cat.update.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const { id, ...rest } = input;
    const [updated] = await pgDatabase
      .update(cat)
      .set(rest)
      .where(and(eq(cat.id, id), eq(cat.houseId, houseId)))
      .returning();
    if (!updated)
      throw new ORPCError("NOT_FOUND", { message: "Cat not found" });
    return updated;
  },
);

export const remove = authContract.cat.remove.handler(
  async ({ input, context: { activeUser, activeMember } }) => {
    const houseId = await requireMutatorAccess(activeUser.id, activeMember);
    const deleted = await pgDatabase
      .delete(cat)
      .where(and(eq(cat.id, input.id), eq(cat.houseId, houseId)))
      .returning({ id: cat.id });
    if (deleted.length === 0) {
      throw new ORPCError("NOT_FOUND", { message: "Cat not found" });
    }
    return true as const;
  },
);
