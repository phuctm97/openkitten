export function formatAnd(...args: string[]) {
  if (args.length <= 1) return args.join("");
  return `${args.slice(0, -1).join(", ")} and ${args[args.length - 1]}`;
}
