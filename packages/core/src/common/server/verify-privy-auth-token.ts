import 'server-only';

/**
 * Privy access-token verification for server routes that need `user_id`.
 * Uses `@privy-io/node` (same as `apps/web` matrix/token route), not chat-server's
 * jose/JWKS helper — that path validates only and does not expose the subject.
 */
import { PrivyClient } from '@privy-io/node';
export type VerifyPrivyAuthTokenResult =
  | { ok: true; userId: string }
  | { ok: false; reason: string };

export async function verifyPrivyAuthToken(
  token: string,
): Promise<VerifyPrivyAuthTokenResult> {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  const appSecret = process.env.PRIVY_APP_SECRET;

  if (!appId || !appSecret) {
    return {
      ok: false,
      reason:
        'Missing required environment variables: NEXT_PUBLIC_PRIVY_APP_ID, PRIVY_APP_SECRET',
    };
  }

  try {
    const privy = new PrivyClient({ appId, appSecret });
    const { user_id: userId } = await privy
      .utils()
      .auth()
      .verifyAuthToken(token);
    return { ok: true, userId };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown auth error';
    console.warn('Privy auth verification failed:', message);
    return { ok: false, reason: message };
  }
}
