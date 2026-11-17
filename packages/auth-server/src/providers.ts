import { createPrivyTokenVerifier } from './privy';

export type ProviderVerifyResult =
  | { ok: true; providerUserId: string }
  | { ok: false; reason: string };

/**
 * A login provider (Privy today). It only turns a provider token into that provider's user id;
 * which Hypha person that is comes from `as_identity` (see db.ts). A new provider is a new
 * verifier registered under its own name: no change to keys, sessions or tokens.
 */
export type ProviderVerifier = (token: string) => Promise<ProviderVerifyResult>;

export type ProviderRegistry = Record<string, ProviderVerifier>;

export function createPrivyProvider(
  appId: string,
  jwksUrlOverride?: string,
): ProviderVerifier {
  const verify = createPrivyTokenVerifier(appId, jwksUrlOverride);
  return async (token) => {
    const r = await verify(token);
    return r.ok
      ? { ok: true, providerUserId: r.userId }
      : { ok: false, reason: r.reason };
  };
}
