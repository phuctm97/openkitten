import { useQuery } from "@tanstack/react-query";
import { orpcUtils } from "~/lib/orpc-utils";

export function useCanMutate(): boolean {
  const data = useQuery(orpcUtils.workspace.sync.queryOptions()).data;
  if (!data) return false;
  const role = data.activeMember.role;
  return role === "owner" || role === "admin";
}
