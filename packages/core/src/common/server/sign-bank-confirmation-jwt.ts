import 'server-only';
import { hkdfSync, randomUUID } from 'node:crypto';
import { EncryptJWT, jwtDecrypt } from 'jose';

/**
 * Carries the bank-onboarding form data + the third-party email across the confirmation
 * email round-trip (#2288). Lives only in the email URL, never at rest in the DB — the DB row
 * (`bank_customers.jwt_nonce`) tracks state only, no PII. See decisions D1/D6.
 *
 * Encrypted (JWE, not a bare signed JWS): the URL this rides in can end up in browser history,
 * email-link scanners, or logs before it's used/rotated, and a signed-only token would let anyone
 * who obtains it read `legalName`/`contactEmail` off the claims even without the secret. AES-256-GCM
 * is authenticated encryption, so it still catches tampering the same way a signature would — this
 * isn't sign-then-encrypt, one layer covers both confidentiality and integrity here.
 */
export type BankConfirmationJwtPayload = {
  ownerType: 'space' | 'person';
  ownerId: number;
  ownerSlug: string;
  /** Space title or person display name — used to personalize the confirmation/verify UI. */
  ownerLabel: string;
  entityType: 'business' | 'individual';
  legalName: string;
  contactEmail: string;
  requestedRails: string[];
  redirectUri?: string;
  /** Person who submitted the onboarding request (already auth-gated, D4). */
  submitterPersonId: number;
};

export type BankConfirmationJwtClaims = BankConfirmationJwtPayload & {
  jti: string;
  exp: number;
};

const BANK_CONFIRMATION_JWT_EXPIRY_SECONDS = 72 * 60 * 60; // 72h, per decisions.md "Resolved"

/**
 * Derives a 32-byte A256GCM content-encryption key from `INTERNAL_JWT_SECRET` via HKDF, rather
 * than feeding the raw secret bytes straight into AES: keeps the encryption key independent of the
 * secret's own length/entropy, and avoids using the exact same key material for two different
 * cryptographic primitives if this secret is ever reused for HMAC signing elsewhere. The `info`
 * string scopes the derivation to this one purpose, so a single `INTERNAL_JWT_SECRET` env var is
 * enough — no separate encryption secret to provision per environment.
 */
function getInternalJweKey(): Uint8Array {
  const secret = process.env.INTERNAL_JWT_SECRET;
  if (!secret) {
    throw new Error(
      'Missing required environment variable: INTERNAL_JWT_SECRET',
    );
  }
  const derived = hkdfSync(
    'sha256',
    Buffer.from(secret, 'utf8'),
    Buffer.alloc(0),
    'hypha:bank-confirmation-jwe',
    32,
  );
  return new Uint8Array(derived);
}

export type SignedBankConfirmationJwt = {
  token: string;
  /** Also stored in `bank_customers.jwt_nonce` to correlate a confirmation click back to its row. */
  nonce: string;
};

export async function signBankConfirmationJwt(
  payload: BankConfirmationJwtPayload,
): Promise<SignedBankConfirmationJwt> {
  const nonce = randomUUID();

  const token = await new EncryptJWT({ ...payload })
    .setProtectedHeader({ alg: 'dir', enc: 'A256GCM' })
    .setJti(nonce)
    .setIssuedAt()
    .setExpirationTime(`${BANK_CONFIRMATION_JWT_EXPIRY_SECONDS}s`)
    .encrypt(getInternalJweKey());

  return { token, nonce };
}

export type VerifyBankConfirmationJwtResult =
  | { valid: true; claims: BankConfirmationJwtClaims }
  | { valid: false; reason: 'expired' | 'invalid' };

export async function verifyBankConfirmationJwt(
  token: string,
): Promise<VerifyBankConfirmationJwtResult> {
  try {
    const { payload } = await jwtDecrypt(token, getInternalJweKey());
    return {
      valid: true,
      claims: payload as unknown as BankConfirmationJwtClaims,
    };
  } catch (error) {
    if (error instanceof Error && error.name === 'JWTExpired') {
      return { valid: false, reason: 'expired' };
    }
    return { valid: false, reason: 'invalid' };
  }
}
