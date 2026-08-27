import 'server-only';
import { randomUUID } from 'node:crypto';
import { jwtVerify, SignJWT } from 'jose';

/**
 * Carries the bank-onboarding form data + the third-party email across the confirmation
 * email round-trip (#2288). Lives only in the email URL, never at rest in the DB — the DB row
 * (`bank_customers.jwt_nonce`) tracks state only, no PII. See decisions D1/D6.
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

function getInternalJwtSecret(): Uint8Array {
  const secret = process.env.INTERNAL_JWT_SECRET;
  if (!secret) {
    throw new Error('Missing required environment variable: INTERNAL_JWT_SECRET');
  }
  return new TextEncoder().encode(secret);
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

  const token = await new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setJti(nonce)
    .setIssuedAt()
    .setExpirationTime(`${BANK_CONFIRMATION_JWT_EXPIRY_SECONDS}s`)
    .sign(getInternalJwtSecret());

  return { token, nonce };
}

export type VerifyBankConfirmationJwtResult =
  | { valid: true; claims: BankConfirmationJwtClaims }
  | { valid: false; reason: 'expired' | 'invalid' };

export async function verifyBankConfirmationJwt(
  token: string,
): Promise<VerifyBankConfirmationJwtResult> {
  try {
    const { payload } = await jwtVerify(token, getInternalJwtSecret());
    return {
      valid: true,
      claims: payload as unknown as BankConfirmationJwtClaims,
    };
  } catch (error) {
    if (
      error instanceof Error &&
      error.name === 'JWTExpired'
    ) {
      return { valid: false, reason: 'expired' };
    }
    return { valid: false, reason: 'invalid' };
  }
}
