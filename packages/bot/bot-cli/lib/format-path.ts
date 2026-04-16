import { homedir } from "node:os";

export function formatPath(absolutePath: string): string {
  const home = homedir();
  return absolutePath.startsWith(home)
    ? absolutePath.replace(home, "~")
    : absolutePath;
}
