import { createRemoteJWKSet, jwtVerify, errors as joseErrors } from 'jose';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID;
if (!PRIVY_APP_ID) {
  throw new Error('Missing required env var: NEXT_PUBLIC_PRIVY_APP_ID');
}

/** Privy's JWKS (avoids same-origin fetch issues on Vercel preview SSO). */
const PRIVY_JWKS_URL = new URL(
  `/api/v1/apps/${PRIVY_APP_ID}/jwks.json`,
  'https://auth.privy.io',
);
const JWKS = createRemoteJWKSet(PRIVY_JWKS_URL);

export async function verifyPrivyAuthToken(
  token: string,
): Promise<{ valid: true } | { valid: false; reason: string }> {
  try {
    await jwtVerify(token, JWKS);
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
