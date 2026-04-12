import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;

function getPrivyJwks() {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
  if (!appId) {
    throw new Error('Missing required env var: NEXT_PUBLIC_PRIVY_APP_ID');
  }
  if (!jwks) {
    const jwksUrl = new URL(
      `/api/v1/apps/${appId}/jwks.json`,
      'https://auth.privy.io',
    );
    jwks = createRemoteJWKSet(jwksUrl);
  }
  return jwks;
}

export async function verifyPrivyAuthToken(
  token: string,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  let keyset: ReturnType<typeof createRemoteJWKSet>;
  try {
    keyset = getPrivyJwks();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Configuration error';
    return { valid: false, reason: message };
  }

  try {
    await jwtVerify(token, keyset);
    return { valid: true };
  } catch (error) {
    if (error instanceof joseErrors.JWTExpired) {
      return { valid: false, reason: 'Token expired' };
    }
    if (error instanceof joseErrors.JWSSignatureVerificationFailed) {
      return { valid: false, reason: 'Invalid token signature' };
    }
    if (error instanceof joseErrors.JWKSNoMatchingKey) {
      return { valid: false, reason: 'No matching key found' };
    }
    return {
      valid: false,
      reason: 'Token verification failed',
    };
  }
}
