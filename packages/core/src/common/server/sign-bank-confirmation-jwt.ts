import 'server-only';

import { SignJWT, jwtVerify } from 'jose';

const JWT_SUBJECT = 'bank-email-confirmation';

function getJwtExpiry(): string {
  return process.env.BANK_EMAIL_CONFIRMATION_TOKEN_EXPIRY?.trim() || '168h';
}

export type BankConfirmationJwtPayload = {
  sub: typeof JWT_SUBJECT;
  jti: string;
  spaceId: number;
  spaceSlug: string;
  spaceBankCustomerId: number;
  provider: string;
  providerCustomerEmail: string;
  legalName: string;
  requestedRails: string[];
  personSlug: string | null;
  spaceTitle: string;
  redirectUri: string | null;
};

export type SignBankConfirmationJwtInput = Omit<
  BankConfirmationJwtPayload,
  'sub'
>;

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.INTERNAL_JWT_SECRET?.trim();
  if (!secret) {
    throw new Error(
      'Missing required environment variable: INTERNAL_JWT_SECRET',
    );
  }
  return new TextEncoder().encode(secret);
}

function parsePayload(
  payload: Record<string, unknown>,
): BankConfirmationJwtPayload {
  const jti = payload.jti;
  const spaceId = payload.spaceId;
  const spaceSlug = payload.spaceSlug;
  const spaceBankCustomerId = payload.spaceBankCustomerId;
  const provider = payload.provider;
  const providerCustomerEmail = payload.providerCustomerEmail;
  const legalName = payload.legalName;
  const requestedRails = payload.requestedRails;
  const personSlug = payload.personSlug;
  const spaceTitle = payload.spaceTitle;
  const redirectUri = payload.redirectUri;

  if (typeof jti !== 'string' || jti.length === 0) {
    throw new Error('Invalid bank confirmation token');
  }
  if (typeof spaceId !== 'number' || !Number.isFinite(spaceId)) {
    throw new Error('Invalid bank confirmation token');
  }
  if (typeof spaceSlug !== 'string' || spaceSlug.length === 0) {
    throw new Error('Invalid bank confirmation token');
  }
  if (
    typeof spaceBankCustomerId !== 'number' ||
    !Number.isFinite(spaceBankCustomerId)
  ) {
    throw new Error('Invalid bank confirmation token');
  }
  if (typeof provider !== 'string' || provider.length === 0) {
    throw new Error('Invalid bank confirmation token');
  }
  if (
    typeof providerCustomerEmail !== 'string' ||
    providerCustomerEmail.length === 0
  ) {
    throw new Error('Invalid bank confirmation token');
  }
  if (typeof legalName !== 'string' || legalName.length === 0) {
    throw new Error('Invalid bank confirmation token');
  }
  if (
    !Array.isArray(requestedRails) ||
    !requestedRails.every((rail) => typeof rail === 'string')
  ) {
    throw new Error('Invalid bank confirmation token');
  }
  if (personSlug !== null && typeof personSlug !== 'string') {
    throw new Error('Invalid bank confirmation token');
  }
  if (typeof spaceTitle !== 'string' || spaceTitle.length === 0) {
    throw new Error('Invalid bank confirmation token');
  }
  if (redirectUri !== null && typeof redirectUri !== 'string') {
    throw new Error('Invalid bank confirmation token');
  }

  return {
    sub: JWT_SUBJECT,
    jti,
    spaceId,
    spaceSlug,
    spaceBankCustomerId,
    provider,
    providerCustomerEmail,
    legalName,
    requestedRails,
    personSlug: personSlug ?? null,
    spaceTitle,
    redirectUri: redirectUri ?? null,
  };
}

export async function signBankConfirmationJwt(
  payload: SignBankConfirmationJwtInput,
): Promise<string> {
  const secret = getJwtSecretKey();

  return new SignJWT({
    spaceId: payload.spaceId,
    spaceSlug: payload.spaceSlug,
    spaceBankCustomerId: payload.spaceBankCustomerId,
    provider: payload.provider,
    providerCustomerEmail: payload.providerCustomerEmail,
    legalName: payload.legalName,
    requestedRails: payload.requestedRails,
    personSlug: payload.personSlug,
    spaceTitle: payload.spaceTitle,
    redirectUri: payload.redirectUri,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(JWT_SUBJECT)
    .setJti(payload.jti)
    .setExpirationTime(getJwtExpiry())
    .sign(secret);
}

export async function verifyBankConfirmationJwt(
  token: string,
): Promise<BankConfirmationJwtPayload> {
  const secret = getJwtSecretKey();
  const { payload } = await jwtVerify(token, secret, {
    subject: JWT_SUBJECT,
  });

  return parsePayload(payload as Record<string, unknown>);
}
