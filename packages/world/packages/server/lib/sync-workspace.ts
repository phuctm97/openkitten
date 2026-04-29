import { generateHouseSlug } from "~/lib/generate-house-slug";
import { pgDatabase } from "~/lib/pg-database";
import { workspace } from "~/lib/schema/app";
import { house, house_member } from "~/lib/schema/auth";
import { WorkspaceNotFoundError } from "~/lib/workspace-not-found-error";

interface SyncWorkspaceUser {
  id: string;
  name: string;
}

type SyncWorkspaceOptions =
  | { user: SyncWorkspaceUser; activeOrganizationId: string }
  | { user: SyncWorkspaceUser };

async function createPersonalWorkspace(
  user: SyncWorkspaceUser,
): Promise<string> {
  const personalName = user.name.trim()
    ? `${user.name.trim()}'s House`
    : "My House";
  const now = new Date();

  return await pgDatabase.transaction(async (tx) => {
    const houseId = Bun.randomUUIDv7();
    await tx.insert(house).values({
      id: houseId,
      name: personalName,
      slug: generateHouseSlug(user.name || user.id),
      logo: null,
      metadata: null,
      createdAt: now,
    });
    await tx.insert(house_member).values({
      id: Bun.randomUUIDv7(),
      house_id: houseId,
      userId: user.id,
      role: "owner",
      createdAt: now,
    });
    const claimed = await tx
      .insert(workspace)
      .values({ houseId, userId: user.id })
      .onConflictDoNothing()
      .returning({ houseId: workspace.houseId });
    if (claimed.length === 0) {
      throw new WorkspaceNotFoundError("auto-create-failed");
    }
    return houseId;
  });
}

async function ensureWorkspaceForHouse(houseId: string): Promise<void> {
  await pgDatabase
    .insert(workspace)
    .values({ houseId, userId: null })
    .onConflictDoNothing();
}

async function resolveHouseId(options: SyncWorkspaceOptions): Promise<string> {
  if ("activeOrganizationId" in options) {
    const membership = await pgDatabase.query.house_member.findFirst({
      where: (table, { and, eq }) =>
        and(
          eq(table.userId, options.user.id),
          eq(table.house_id, options.activeOrganizationId),
        ),
      columns: { id: true },
    });
    if (membership) {
      await ensureWorkspaceForHouse(options.activeOrganizationId);
      return options.activeOrganizationId;
    }
  }

  const personal = await pgDatabase.query.workspace.findFirst({
    where: (table, { eq }) => eq(table.userId, options.user.id),
    columns: { houseId: true },
  });
  if (personal) return personal.houseId;

  const firstMembership = await pgDatabase.query.house_member.findFirst({
    where: (table, { eq }) => eq(table.userId, options.user.id),
    columns: { house_id: true },
    orderBy: (table, { asc }) => asc(table.createdAt),
  });
  if (firstMembership) {
    await ensureWorkspaceForHouse(firstMembership.house_id);
    return firstMembership.house_id;
  }

  return await createPersonalWorkspace(options.user);
}

async function resolveHouseIdWithRetry(
  options: SyncWorkspaceOptions,
): Promise<string> {
  try {
    return await resolveHouseId(options);
  } catch (error) {
    if (
      error instanceof WorkspaceNotFoundError &&
      error.reason === "auto-create-failed"
    ) {
      return await resolveHouseId(options);
    }
    throw error;
  }
}

export async function syncWorkspace(options: SyncWorkspaceOptions) {
  const houseId = await resolveHouseIdWithRetry(options);

  const houseData = await pgDatabase.query.house.findFirst({
    where: (table, { eq }) => eq(table.id, houseId),
    with: {
      workspace: true,
      house_members: {
        with: {
          user: {
            columns: { id: true, name: true, email: true, image: true },
          },
        },
      },
      house_invitations: {
        where: (table, { eq }) => eq(table.status, "pending"),
      },
    },
  });
  if (!houseData) throw new WorkspaceNotFoundError("house-missing");
  if (!houseData.workspace) {
    throw new WorkspaceNotFoundError("workspace-missing");
  }

  const activeMember = houseData.house_members.find(
    (m) => m.userId === options.user.id,
  );
  if (!activeMember) throw new WorkspaceNotFoundError("membership-missing");

  return {
    workspace: {
      id: houseData.workspace.id,
      userId: houseData.workspace.userId,
      houseId: houseData.workspace.houseId,
      isPersonal: houseData.workspace.userId !== null,
      createdAt: houseData.workspace.createdAt,
      updatedAt: houseData.workspace.updatedAt,
    },
    house: {
      id: houseData.id,
      name: houseData.name,
      slug: houseData.slug,
      logo: houseData.logo,
      metadata: houseData.metadata,
      createdAt: houseData.createdAt,
    },
    members: houseData.house_members.map((m) => ({
      id: m.id,
      userId: m.userId,
      role: m.role,
      createdAt: m.createdAt,
      user: m.user,
    })),
    invitations: houseData.house_invitations.map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role,
      status: i.status,
      expiresAt: i.expiresAt,
    })),
    activeMember: {
      id: activeMember.id,
      role: activeMember.role,
      createdAt: activeMember.createdAt,
    },
  };
}
