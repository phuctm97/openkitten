const maxDraftId = BigInt(Number.MAX_SAFE_INTEGER);

export function grammyBuildDraftId(messageId: string): number {
  const digest = Bun.CryptoHasher.hash("sha256", messageId);

  let value = 0n;
  for (const byte of digest.subarray(0, 8)) {
    value = (value << 8n) | BigInt(byte);
  }

  return Number((value % maxDraftId) + 1n);
}
