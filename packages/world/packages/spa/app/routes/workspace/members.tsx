import { useOutletContext } from "react-router";

import { OrganizationInvitationsCard } from "~/components/auth/organization-invitations-card";
import { OrganizationMembersCard } from "~/components/auth/organization-members-card";

interface WorkspaceContext {
  organizationId: string;
}

export default function Component() {
  const { organizationId } = useOutletContext<WorkspaceContext>();
  return (
    <div className="space-y-6">
      <OrganizationMembersCard organizationId={organizationId} />
      <OrganizationInvitationsCard organizationId={organizationId} />
    </div>
  );
}
