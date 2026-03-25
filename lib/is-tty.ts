export const isTTY: number = !!(process.stdin.isTTY && process.stdout.isTTY);
