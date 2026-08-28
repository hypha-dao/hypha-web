import { randomUUID } from 'node:crypto';

import type { DatabaseInstance } from '../../common/server/types';
import {
  bridgeFindCustomerByEmail,
  bridgeGetKycLink,
  type BridgeGetCustomerResponse,
} from '../../common/server/bridge-client';
import {
  signBankConfirmationJwt,
  verifyBankConfirmationJwt,
  type BankConfirmationJwtClaims,
} from '../../common/server/sign-bank-confirmation-jwt';
import { isBypassEligible } from '../normalize-email-for-bypass';
import { DEFAULT_BANK_PROVIDER, currenciesToEndorsements } from '../constants';
import type { BankEntityType, BankValidationRequirement } from '../types';
import {
  findBankCustomerByNonce,
  findBankCustomerBySpaceAndProvider,
  findBankCustomerByPersonAndProvider,
} from './queries';
import {
  claimBankCustomerForConfirmation,
  insertBankCustomer,
  updateBankCustomer,
} from './mutations';
import { getBankKycProvider } from './providers';
import type { BankKycProvider } from './providers/types';
import { buildCustomerValidations } from './providers/bridge/banking-provider-state';

/**
 * Owner-agnostic reference for the shared #2288 gate — one implementation for both space and
 * personal Bridge onboarding (decision D6). `label` personalizes the confirmation email / verify
 * page copy (space title or person display name).
 */
export type BankOnboardingOwnerRef = {
  type: 'space' | 'person';
  id: number;
  slug: string;
  label: string;
};

export type BankOnboardingConfirmationOptions = {
  kycProvider?: BankKycProvider;
};

type KycLinkAndValidations = {
  normalizedRails: string[];
  providerCustomerId: string | null;
  providerKycLinkId: string;
  kycLink: string | null;
  tosLink: string | null;
  procedures: {
    tos: BankValidationRequirement;
    kyc: BankValidationRequirement;
  };
};

async function buildKycLinkAndValidations(
  input: {
    entityType: BankEntityType;
    legalName: string;
    contactEmail: string;
    requestedRails?: string[];
    redirectUri?: string;
    /**
     * Stable across retries of the *same* confirmation (e.g. the confirm path passes the token's
     * `jti`) so a retry after a persistence failure replays against Bridge instead of minting a
     * second KYC link for the same request. Defaults to a fresh key for call sites that don't need
     * that (direct/bypass create has no retry-after-partial-failure path to protect).
     */
    idempotencyKey?: string;
  },
  options?: BankOnboardingConfirmationOptions,
): Promise<KycLinkAndValidations> {
  const normalizedRails =
    input.requestedRails?.map((r) => r.toLowerCase()) ?? [];
  const endorsements = currenciesToEndorsements(normalizedRails);
  const idempotencyKey = input.idempotencyKey ?? randomUUID();
  const kycProvider =
    options?.kycProvider ?? getBankKycProvider(DEFAULT_BANK_PROVIDER);

  const kycLinkResult = await kycProvider.createKycLink({
    entityType: input.entityType,
    legalName: input.legalName,
    contactEmail: input.contactEmail,
    idempotencyKey,
    endorsements,
    redirectUri: input.redirectUri,
  });

  const validations = buildCustomerValidations({
    id: kycLinkResult.providerKycLinkId,
    kyc_link: kycLinkResult.kycLink,
    kyc_status: kycLinkResult.kycStatus,
    tos_status: kycLinkResult.tosStatus,
    tos_link: kycLinkResult.tosLink,
    customer_id: kycLinkResult.providerCustomerId,
  });

  return {
    normalizedRails,
    providerCustomerId: kycLinkResult.providerCustomerId,
    providerKycLinkId: kycLinkResult.providerKycLinkId,
    kycLink: validations.kycLink,
    tosLink: validations.tosLink,
    procedures: { tos: validations.tos, kyc: validations.kyc },
  };
}

function ownerIdColumns(
  ownerRef: BankOnboardingOwnerRef,
): { spaceId: number } | { personId: number } {
  return ownerRef.type === 'space'
    ? { spaceId: ownerRef.id }
    : { personId: ownerRef.id };
}

async function findExistingBankCustomerForOwner(
  ownerRef: BankOnboardingOwnerRef,
  { db }: { db: DatabaseInstance },
) {
  return ownerRef.type === 'space'
    ? findBankCustomerBySpaceAndProvider(
        { spaceId: ownerRef.id, provider: DEFAULT_BANK_PROVIDER },
        { db },
      )
    : findBankCustomerByPersonAndProvider(
        { personId: ownerRef.id, provider: DEFAULT_BANK_PROVIDER },
        { db },
      );
}

/** Bypass or resend-of-an-already-linked-customer path: create + insert directly. */
export async function createBankCustomerWithKycLink(
  ownerRef: BankOnboardingOwnerRef,
  input: {
    entityType: BankEntityType;
    legalName: string;
    contactEmail: string;
    requestedRails?: string[];
    redirectUri?: string;
  },
  { db }: { db: DatabaseInstance },
  options?: BankOnboardingConfirmationOptions,
): Promise<KycLinkAndValidations> {
  const result = await buildKycLinkAndValidations(input, options);

  await insertBankCustomer(
    {
      ...ownerIdColumns(ownerRef),
      entityType: input.entityType,
      provider: DEFAULT_BANK_PROVIDER,
      providerCustomerId: result.providerCustomerId,
      providerKycLinkId: result.providerKycLinkId,
      requestedRails: result.normalizedRails,
    },
    { db },
  );

  return result;
}

/** Confirm path (D6) — finalizes a pending row (created by `requestBankOnboardingWithConfirmation` below). */
async function finalizePendingBankCustomerWithKycLink(
  bankCustomerId: number,
  input: {
    entityType: BankEntityType;
    legalName: string;
    contactEmail: string;
    requestedRails?: string[];
    redirectUri?: string;
    idempotencyKey?: string;
  },
  { db }: { db: DatabaseInstance },
  options?: BankOnboardingConfirmationOptions,
): Promise<KycLinkAndValidations> {
  const result = await buildKycLinkAndValidations(input, options);

  await updateBankCustomer(
    {
      id: bankCustomerId,
      providerCustomerId: result.providerCustomerId,
      providerKycLinkId: result.providerKycLinkId,
      requestedRails: result.normalizedRails,
      jwtNonce: null,
    },
    { db },
  );

  return result;
}

export type RequestBankOnboardingWithConfirmationInput = {
  ownerRef: BankOnboardingOwnerRef;
  entityType: BankEntityType;
  legalName: string;
  contactEmail: string;
  requestedRails?: string[];
  redirectUri?: string;
  /** Already auth-gated (D4) — the person who submitted the form. */
  submitterPersonId: number;
  /** The submitter's own verified `people.email`, or null if unset. */
  submitterEmail: string | null;
  /**
   * Server-only callback that receives the confirmation token to email out. The token is never
   * included in this function's return value — it must not reach the HTTP response layer, or the
   * submitter could self-confirm an email they don't own, defeating the whole gate.
   */
  sendConfirmationEmail: (input: {
    token: string;
    ownerLabel: string;
    contactEmail: string;
  }) => Promise<void>;
};

export type RequestBankOnboardingWithConfirmationResult =
  | ({ kind: 'created' | 'existing' } & KycLinkAndValidations)
  | { kind: 'pendingConfirmation' };

/**
 * The shared #2288 gate (D6). Owns the per-owner idempotency dedup (D7) internally, so both
 * `requestSpaceBankOnboarding` and `requestPersonalBankOnboarding` can stay thin wrappers around
 * their owner-specific auth check. Bypass decision is entirely server-side — never trust a
 * client-supplied bypass flag.
 */
export async function requestBankOnboardingWithConfirmation(
  input: RequestBankOnboardingWithConfirmationInput,
  { db }: { db: DatabaseInstance },
  options?: BankOnboardingConfirmationOptions,
): Promise<RequestBankOnboardingWithConfirmationResult> {
  const {
    ownerRef,
    entityType,
    legalName,
    contactEmail,
    requestedRails,
    redirectUri,
    submitterEmail,
    sendConfirmationEmail,
  } = input;

  const existing = await findExistingBankCustomerForOwner(ownerRef, { db });

  if (existing?.providerKycLinkId) {
    const kycLink = await bridgeGetKycLink(existing.providerKycLinkId);
    const validations = buildCustomerValidations(kycLink);
    return {
      kind: 'existing',
      normalizedRails: existing.requestedRails ?? [],
      providerCustomerId: existing.providerCustomerId,
      providerKycLinkId: existing.providerKycLinkId,
      kycLink: validations.kycLink,
      tosLink: validations.tosLink,
      procedures: { tos: validations.tos, kyc: validations.kyc },
    };
  }

  if (isBypassEligible(submitterEmail, contactEmail)) {
    // A pending (unconfirmed) row from an earlier non-bypass attempt already occupies the
    // owner+provider unique slot — finalize it in place rather than inserting a duplicate, which
    // would violate that constraint after Bridge's KYC link is already created.
    const result = existing
      ? await finalizePendingBankCustomerWithKycLink(
          existing.id,
          { entityType, legalName, contactEmail, requestedRails, redirectUri },
          { db },
          options,
        )
      : await createBankCustomerWithKycLink(
          ownerRef,
          { entityType, legalName, contactEmail, requestedRails, redirectUri },
          { db },
          options,
        );
    return { kind: 'created', ...result };
  }

  const normalizedRails = requestedRails?.map((r) => r.toLowerCase()) ?? [];
  const { token, nonce } = await signBankConfirmationJwt({
    ownerType: ownerRef.type,
    ownerId: ownerRef.id,
    ownerSlug: ownerRef.slug,
    ownerLabel: ownerRef.label,
    entityType,
    legalName,
    contactEmail,
    requestedRails: normalizedRails,
    redirectUri,
    submitterPersonId: input.submitterPersonId,
  });

  if (existing) {
    // Resend (or a retry landing here while a confirm-in-progress has momentarily cleared the
    // nonce, mid-claim): rotate/set the nonce on the existing pending row (D3) instead of
    // inserting a duplicate (would violate the owner+provider unique index anyway). Keyed on
    // `existing` rather than `existing.jwtNonce` so this still works while a row is claimed
    // (jwtNonce temporarily null) — `existing` only ever reaches this branch unconfirmed
    // (the providerKycLinkId check above already returned for a linked row).
    await updateBankCustomer(
      { id: existing.id, jwtNonce: nonce, requestedRails: normalizedRails },
      { db },
    );
  } else {
    await insertBankCustomer(
      {
        ...ownerIdColumns(ownerRef),
        entityType,
        provider: DEFAULT_BANK_PROVIDER,
        providerCustomerId: null,
        providerKycLinkId: null,
        jwtNonce: nonce,
        requestedRails: normalizedRails,
      },
      { db },
    );
  }

  await sendConfirmationEmail({
    token,
    ownerLabel: ownerRef.label,
    contactEmail,
  });

  return { kind: 'pendingConfirmation' };
}

export type ConfirmBankEmailResult =
  | ({
      ok: true;
      ownerType: 'space' | 'person';
      ownerId: number;
      ownerSlug: string;
      ownerLabel: string;
      /** Informational only (D7) — an existing Bridge customer under this email is fine once ownership is proven. */
      existingBridgeCustomer: BridgeGetCustomerResponse | null;
    } & KycLinkAndValidations)
  | { ok: false; reason: 'expired' | 'invalid' | 'already_confirmed' };

/** Called from the public `/verify/banking` confirmation endpoint — no Privy auth (D4: the JWT *is* the authorization). */
export async function confirmBankEmail(
  token: string,
  { db }: { db: DatabaseInstance },
  options?: BankOnboardingConfirmationOptions,
): Promise<ConfirmBankEmailResult> {
  const verified = await verifyBankConfirmationJwt(token);
  if (!verified.valid) {
    return { ok: false, reason: verified.reason };
  }

  const claims: BankConfirmationJwtClaims = verified.claims;
  const row = await findBankCustomerByNonce(claims.jti, { db });

  if (!row || row.jwtNonce !== claims.jti) {
    // Nonce rotated (resend) or row gone — the link that was clicked is no longer live (D3).
    return { ok: false, reason: 'invalid' };
  }

  if (row.providerKycLinkId) {
    return { ok: false, reason: 'already_confirmed' };
  }

  // Atomically claim the row before calling the provider: a concurrent confirm of the same link
  // (double-click, or a race with a resend that rotates the nonce) fails this compare-and-swap and
  // is rejected here rather than both requests creating their own KYC link for the same owner.
  const claimed = await claimBankCustomerForConfirmation(
    { id: row.id, expectedNonce: claims.jti },
    { db },
  );
  if (!claimed) {
    return { ok: false, reason: 'invalid' };
  }

  const existingBridgeCustomer = await bridgeFindCustomerByEmail(
    claims.contactEmail,
  ).catch(() => null);

  let result: KycLinkAndValidations;
  try {
    result = await finalizePendingBankCustomerWithKycLink(
      claimed.id,
      {
        // Stable per-token idempotency key (not a fresh randomUUID() per attempt): if
        // finalization fails after Bridge already created the KYC link (e.g. the DB update
        // throws, or a resend/retry replays this same claim), Bridge treats a retry with the
        // same key as the original request and returns the existing resource instead of
        // minting a second one.
        idempotencyKey: `bank-confirm:${claims.jti}`,
        entityType: claims.entityType,
        legalName: claims.legalName,
        contactEmail: claims.contactEmail,
        requestedRails: claims.requestedRails,
        redirectUri: claims.redirectUri,
      },
      { db },
      options,
    );
  } catch (error) {
    // Restore the nonce so the same confirmation link (or a resend) can still complete the row
    // instead of leaving it permanently stuck: not pending (no nonce) but not confirmed either.
    await updateBankCustomer({ id: claimed.id, jwtNonce: claims.jti }, { db });
    throw error;
  }

  return {
    ok: true,
    ownerType: claims.ownerType,
    ownerId: claims.ownerId,
    ownerSlug: claims.ownerSlug,
    ownerLabel: claims.ownerLabel,
    existingBridgeCustomer,
    ...result,
  };
}
