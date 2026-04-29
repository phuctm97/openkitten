import { authClient } from "~/lib/auth-client";
import { orgMutationKeys } from "~/lib/org-mutation-keys";
import { orgQueryKeys } from "~/lib/org-query-keys";
import { queryClient } from "~/lib/query-client";
import { sessionQueryOptions } from "~/lib/session-query-options";

type OrgMethod<K extends keyof typeof authClient.organization> =
  (typeof authClient.organization)[K];
type OrgInput<K extends keyof typeof authClient.organization> =
  OrgMethod<K> extends (input: infer I) => unknown ? I : never;

const invalidateAll = () =>
  queryClient.invalidateQueries({ queryKey: orgQueryKeys.all });

const invalidateList = () =>
  queryClient.invalidateQueries({ queryKey: orgQueryKeys.list });

const invalidateFull = () =>
  queryClient.invalidateQueries({ queryKey: orgQueryKeys.full });

const invalidateMembers = () =>
  queryClient.invalidateQueries({ queryKey: orgQueryKeys.members });

const invalidateInvitations = () =>
  queryClient.invalidateQueries({ queryKey: orgQueryKeys.invitations });

const invalidateInvitation = () =>
  queryClient.invalidateQueries({ queryKey: orgQueryKeys.invitation });

const invalidateSession = () =>
  queryClient.invalidateQueries({ queryKey: sessionQueryOptions.queryKey });

export const orgMutationOptions = {
  create: () => ({
    mutationKey: [...orgMutationKeys.organizations, "create"] as const,
    mutationFn: (input: OrgInput<"create">) =>
      authClient.organization.create({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: invalidateList,
  }),

  delete: () => ({
    mutationKey: [...orgMutationKeys.active, "delete"] as const,
    mutationFn: (input: OrgInput<"delete">) =>
      authClient.organization.delete({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: invalidateAll,
  }),

  setActive: () => ({
    mutationKey: [...orgMutationKeys.active, "setActive"] as const,
    mutationFn: (input: OrgInput<"setActive">) =>
      authClient.organization.setActive({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: () =>
      Promise.all([
        invalidateAll(),
        invalidateSession(),
        queryClient.invalidateQueries(),
      ]),
  }),

  update: () => ({
    mutationKey: [...orgMutationKeys.active, "update"] as const,
    mutationFn: (input: OrgInput<"update">) =>
      authClient.organization.update({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: () => Promise.all([invalidateList(), invalidateFull()]),
  }),

  inviteMember: () => ({
    mutationKey: [...orgMutationKeys.active, "inviteMember"] as const,
    mutationFn: (input: OrgInput<"inviteMember">) =>
      authClient.organization.inviteMember({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: invalidateInvitations,
  }),

  removeMember: () => ({
    mutationKey: [...orgMutationKeys.active, "removeMember"] as const,
    mutationFn: (input: OrgInput<"removeMember">) =>
      authClient.organization.removeMember({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: invalidateMembers,
  }),

  updateMemberRole: () => ({
    mutationKey: [...orgMutationKeys.active, "updateMemberRole"] as const,
    mutationFn: (input: OrgInput<"updateMemberRole">) =>
      authClient.organization.updateMemberRole({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: invalidateMembers,
  }),

  cancelInvitation: () => ({
    mutationKey: [...orgMutationKeys.active, "cancelInvitation"] as const,
    mutationFn: (input: OrgInput<"cancelInvitation">) =>
      authClient.organization.cancelInvitation({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: invalidateInvitations,
  }),

  acceptInvitation: () => ({
    mutationKey: [...orgMutationKeys.active, "acceptInvitation"] as const,
    mutationFn: (input: OrgInput<"acceptInvitation">) =>
      authClient.organization.acceptInvitation({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: () => Promise.all([invalidateList(), invalidateInvitation()]),
  }),

  rejectInvitation: () => ({
    mutationKey: [...orgMutationKeys.active, "rejectInvitation"] as const,
    mutationFn: (input: OrgInput<"rejectInvitation">) =>
      authClient.organization.rejectInvitation({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: invalidateInvitation,
  }),

  leave: () => ({
    mutationKey: [...orgMutationKeys.active, "leave"] as const,
    mutationFn: (input: OrgInput<"leave">) =>
      authClient.organization.leave({
        ...input,
        fetchOptions: { throw: true },
      }),
    onSettled: invalidateAll,
  }),
};
