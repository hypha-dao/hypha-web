import { describe, expect, it } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { verifyAccessToken } from '@privy-io/node';

/**
 * `verifyPrivyAuthToken` delegates to the Privy SDK's access-token check with
 * the app's verification key. This test runs that SDK check on locally signed
 * tokens (no network, no real Privy key): issuer, audience (the app id) and
 * signature decide; nothing about the app client is checked, so a token minted
 * for a second client of the same app passes. It cannot prove what a real
 * second client's token contains: that needs one real login (gate G-A1).
 */
const APP_ID = 'app-id-placeholder';

async function sign(
  key: CryptoKey,
  claims: { aud?: string; iss?: string; cid?: string },
) {
  return new SignJWT({
    sid: 'session-1',
    ...(claims.cid ? { cid: claims.cid } : {}),
  })
    .setProtectedHeader({ alg: 'ES256', typ: 'JWT' })
    .setIssuer(claims.iss ?? 'privy.io')
    .setAudience(claims.aud ?? APP_ID)
    .setSubject('did:privy:user-1')
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(key);
}

describe('Privy access token: the client id is not checked', () => {
  it('accepts tokens whatever client they come from, same app', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    for (const cid of [undefined, 'client-main', 'client-host-a']) {
      const token = await sign(privateKey, { cid });
      const result = await verifyAccessToken({
        access_token: token,
        app_id: APP_ID,
        verification_key: publicKey,
      });
      expect(result.user_id).toBe('did:privy:user-1');
    }
  });

  it('still refuses another app, another issuer and a foreign signature', async () => {
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const { privateKey: otherKey } = await generateKeyPair('ES256');
    const cases = [
      await sign(privateKey, { aud: 'another-app' }),
      await sign(privateKey, { iss: 'evil.example' }),
      await sign(otherKey, {}),
    ];
    for (const token of cases) {
      await expect(
        verifyAccessToken({
          access_token: token,
          app_id: APP_ID,
          verification_key: publicKey,
        }),
      ).rejects.toThrow();
    }
  });
});
