import { me } from "./me";
import { workspaceSync } from "./workspace";

export const router = {
  me,
  workspace: {
    sync: workspaceSync,
  },
};
