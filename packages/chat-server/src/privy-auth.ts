import { verifyPrivyAuthToken as verifyPrivyAuthTokenCore } from '@hypha-platform/core/server';

/** Privy access-token verification — uses `@privy-io/node` (same as matrix/token route). */
export async function verifyPrivyAuthToken(
  token: string,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  const result = await verifyPrivyAuthTokenCore(token);
  if (result.ok) {
    return { valid: true };
  }
  return { valid: false, reason: result.reason };
}
