import { useOutletContext } from "react-router";

import { DeleteOrganizationCard } from "~/components/auth/delete-organization-card";
import { OrganizationNameCard } from "~/components/auth/organization-name-card";
import { OrganizationSlugCard } from "~/components/auth/organization-slug-card";

interface WorkspaceContext {
  organizationId: string;
}

export default function Component() {
  const { organizationId } = useOutletContext<WorkspaceContext>();
  return (
    <div className="space-y-6">
      <OrganizationNameCard organizationId={organizationId} />
      <OrganizationSlugCard organizationId={organizationId} />
      <DeleteOrganizationCard organizationId={organizationId} />
    </div>
  );
}
