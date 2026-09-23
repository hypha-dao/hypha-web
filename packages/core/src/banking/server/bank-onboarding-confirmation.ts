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
import { currenciesToEndorsements } from '../constants';
import type {
  BankEntityType,
  BankProvider,
  BankValidationRequirement,
} from '../types';
import {
  findBankCustomerByNonce,
  findBankCustomerBySpaceAndProvider,
  findBankCustomerByPersonAndProvider,
} from './queries';
import {
  claimBankCustomerForConfirmation,
  finalizeClaimedBankCustomer,
  insertBankCustomer,
  releaseBankCustomerClaim,
  updateBankCustomer,
} from './mutations';
import {
  getBankIdentityProvider,
  resolveProviderForOnboarding,
} from './providers';
import { BankOnboardingError } from './errors';
import type { BankIdentityProvider } from './providers/types';
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
  /**
   * Identity/KYC provider to use. Callers resolve this from `requestedRails`
   * (`resolveProviderForOnboarding`, WS4) and pass it in explicitly; a direct call that omits it
   * (mainly tests) falls back to `DEFAULT_BANK_PROVIDER` (Bridge) via the same resolver applied to
   * an empty rail list.
   */
  kycProvider?: BankIdentityProvider;
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

/**
 * Provider-neutral procedures/link shape for a freshly-created (or freshly-read) KYC result —
 * resolves plan callout 2 (D12). Bridge's richer `buildCustomerValidations` (submitted-status
 * heuristics for disabling an in-progress link) stays reserved for the Bridge-only "resume an
 * existing link" path below, where the status may be stale/mid-review; immediately after creation
 * every provider's status is fresh, so the simpler `isApproved`-driven shape here is equivalent.
 */
function buildProceduresFromKycResult(result: {
  kycStatus: string;
  isApproved: boolean;
  tosStatus: string | null;
  kycLink: string | null;
  tosLink: string | null;
}): {
  tos: BankValidationRequirement;
  kyc: BankValidationRequirement;
  kycLink: string | null;
  tosLink: string | null;
} {
  const tosApproved = result.tosStatus === 'approved';
  return {
    kycLink: result.kycLink,
    tosLink: result.tosLink,
    tos: {
      key: 'tos',
      status: result.tosStatus,
      isComplete: tosApproved,
      action:
        result.tosLink && !tosApproved
          ? { type: 'link', url: result.tosLink }
          : undefined,
      linkDisabled: tosApproved,
    },
    kyc: {
      key: 'kyc',
      status: result.kycStatus,
      isComplete: result.isApproved,
      action:
        result.kycLink && !result.isApproved
          ? { type: 'link', url: result.kycLink }
          : undefined,
      linkDisabled: result.isApproved,
    },
  };
}

/** Resolves the identity provider to use, honouring an explicit override (mainly tests, D13). */
function resolveKycProvider(
  requestedRails: readonly string[] | undefined,
  options?: BankOnboardingConfirmationOptions,
): BankIdentityProvider {
  return (
    options?.kycProvider ??
    getBankIdentityProvider(resolveProviderForOnboarding(requestedRails))
  );
}

async function buildKycLinkAndValidations(
  input: {
    entityType: BankEntityType;
    legalName: string;
    contactEmail: string;
    requestedRails?: string[];
    redirectUri?: string;
    /** Provider-specific onboarding fields the dynamic form collected (D10). */
    onboardingFields?: Record<string, string>;
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
  const kycProvider = resolveKycProvider(input.requestedRails, options);

  const kycLinkResult = await kycProvider.createKycLink({
    entityType: input.entityType,
    legalName: input.legalName,
    contactEmail: input.contactEmail,
    idempotencyKey,
    endorsements,
    redirectUri: input.redirectUri,
    onboardingFields: input.onboardingFields,
  });

  const validations = buildProceduresFromKycResult(kycLinkResult);

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
  provider: BankProvider,
  { db }: { db: DatabaseInstance },
) {
  return ownerRef.type === 'space'
    ? findBankCustomerBySpaceAndProvider(
        { spaceId: ownerRef.id, provider },
        { db },
      )
    : findBankCustomerByPersonAndProvider(
        { personId: ownerRef.id, provider },
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
    onboardingFields?: Record<string, string>;
  },
  { db }: { db: DatabaseInstance },
  options?: BankOnboardingConfirmationOptions,
): Promise<KycLinkAndValidations> {
  const kycProvider = resolveKycProvider(input.requestedRails, options);
  const result = await buildKycLinkAndValidations(input, { kycProvider });

  await insertBankCustomer(
    {
      ...ownerIdColumns(ownerRef),
      entityType: input.entityType,
      provider: kycProvider.provider,
      providerCustomerId: result.providerCustomerId,
      providerKycLinkId: result.providerKycLinkId,
      requestedRails: result.normalizedRails,
    },
    { db },
  );

  return result;
}

/**
 * Confirm path's final write (#2288) — conditioned on `jwt_nonce` still being `NULL` (the state
 * the claim step left it in), not just the row id (see `finalizeClaimedBankCustomer`). Returns
 * `null`, rather than throwing, if a resend rotated `jwt_nonce` while the provider call was in
 * flight: that's not a failure of the provider call (which may well have succeeded), it means this
 * attempt lost the race and must not report success — see `confirmBankEmail`.
 */
async function finalizeClaimedBankCustomerWithKycLink(
  bankCustomerId: number,
  input: {
    entityType: BankEntityType;
    legalName: string;
    contactEmail: string;
    requestedRails?: string[];
    redirectUri?: string;
    onboardingFields?: Record<string, string>;
    idempotencyKey?: string;
  },
  { db }: { db: DatabaseInstance },
  options?: BankOnboardingConfirmationOptions,
): Promise<KycLinkAndValidations | null> {
  const result = await buildKycLinkAndValidations(input, options);

  const row = await finalizeClaimedBankCustomer(
    {
      id: bankCustomerId,
      providerCustomerId: result.providerCustomerId,
      providerKycLinkId: result.providerKycLinkId,
      requestedRails: result.normalizedRails,
    },
    { db },
  );

  return row ? result : null;
}

export type RequestBankOnboardingWithConfirmationInput = {
  ownerRef: BankOnboardingOwnerRef;
  entityType: BankEntityType;
  legalName: string;
  contactEmail: string;
  requestedRails?: string[];
  redirectUri?: string;
  /** Provider-specific onboarding fields the dynamic form collected (D10). */
  onboardingFields?: Record<string, string>;
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
    onboardingFields,
    submitterEmail,
    sendConfirmationEmail,
  } = input;

  const kycProvider = resolveKycProvider(requestedRails, options);
  const resolvedOptions: BankOnboardingConfirmationOptions = { kycProvider };

  const existing = await findExistingBankCustomerForOwner(
    ownerRef,
    kycProvider.provider,
    { db },
  );

  if (existing?.providerKycLinkId) {
    if (kycProvider.provider === 'bridge') {
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

    // Non-Bridge providers (AUDD): there is no endpoint to re-fetch the hosted KYC link after
    // creation (audd-gateway-api-reference.md — `verificationUrl` is only ever returned once,
    // from the original `POST .../kyc` response). Best effort: report live status via
    // `getKycStatus`; a returning visitor won't see the original link again here.
    const status = await kycProvider.getKycStatus({ customer: existing });
    const validations = buildProceduresFromKycResult({
      kycStatus: status?.kycStatus ?? 'PENDING',
      isApproved: status?.isApproved ?? false,
      tosStatus: status?.tosStatus ?? null,
      kycLink: status?.kycLink ?? null,
      // KycStatusResult carries no tosLink (only CreateKycLinkResult does) — AUDD has no separate
      // TOS step anyway (tosStatus is always null), so this is never actionable for this provider.
      tosLink: null,
    });
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
    // owner+provider unique slot — take it over rather than inserting a duplicate, which would
    // violate that constraint after Bridge's KYC link is already created. Goes through the same
    // claim/finalize CAS as the confirm path (not a plain update by id): a resend or an in-flight
    // confirmation racing this bypass request must not have either write silently clobber the
    // other's result.
    let result: KycLinkAndValidations;
    if (existing) {
      if (!existing.jwtNonce) {
        // Already claimed by an in-flight confirmation (nonce cleared, not yet finalized) —
        // nothing valid to atomically take over from here.
        throw new BankOnboardingError(
          'A confirmation for this owner is already being processed. Please try again in a moment.',
          409,
        );
      }
      const claimed = await claimBankCustomerForConfirmation(
        { id: existing.id, expectedNonce: existing.jwtNonce },
        { db },
      );
      if (!claimed) {
        throw new BankOnboardingError(
          'This request just changed — please try again.',
          409,
        );
      }
      const finalized = await finalizeClaimedBankCustomerWithKycLink(
        claimed.id,
        {
          entityType,
          legalName,
          contactEmail,
          requestedRails,
          redirectUri,
          onboardingFields,
        },
        { db },
        resolvedOptions,
      );
      if (!finalized) {
        throw new BankOnboardingError(
          'This request just changed — please try again.',
          409,
        );
      }
      result = finalized;
    } else {
      result = await createBankCustomerWithKycLink(
        ownerRef,
        {
          entityType,
          legalName,
          contactEmail,
          requestedRails,
          redirectUri,
          onboardingFields,
        },
        { db },
        resolvedOptions,
      );
    }
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
    onboardingFields,
  });

  if (existing) {
    // Resend (or a retry landing here while a confirm-in-progress has claimed the row, jwtNonce
    // momentarily null): set the nonce on the existing pending row (D3) instead of inserting a
    // duplicate (would violate the owner+provider unique index anyway). Keyed on `existing`
    // rather than `existing.jwtNonce` so this still works while a row is claimed — `existing`
    // only ever reaches this branch unconfirmed (the providerKycLinkId check above already
    // returned for a linked row).
    //
    // This unconditional write is also what makes resend an *instant* revocation of an in-flight
    // confirmation, not just of future clicks of the old link: it always sets jwtNonce to a fresh
    // non-null value, so a confirmation that already claimed the row (jwtNonce -> null) finds its
    // final write's `WHERE jwt_nonce IS NULL` no longer matches once this commits — see
    // `finalizeClaimedBankCustomer`.
    await updateBankCustomer(
      { id: existing.id, jwtNonce: nonce, requestedRails: normalizedRails },
      { db },
    );
  } else {
    await insertBankCustomer(
      {
        ...ownerIdColumns(ownerRef),
        entityType,
        provider: kycProvider.provider,
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

  // Provider is re-resolved from the claims' `requestedRails` (D2 — no provider claim carried in
  // the token itself), honouring an explicit test override the same way every other entrypoint
  // does.
  const kycProvider = resolveKycProvider(claims.requestedRails, options);
  const resolvedOptions: BankOnboardingConfirmationOptions = { kycProvider };

  // Bridge-only email dedup pre-check (#2288 D7) — informational, not a gate. AUDD relies on its
  // own idempotency (create-customer 409s on a duplicate email within the same company).
  const existingBridgeCustomer =
    kycProvider.provider === 'bridge'
      ? await bridgeFindCustomerByEmail(claims.contactEmail).catch(() => null)
      : null;

  let result: KycLinkAndValidations | null;
  try {
    result = await finalizeClaimedBankCustomerWithKycLink(
      claimed.id,
      {
        // Stable per-token idempotency key (not a fresh randomUUID() per attempt): if
        // finalization fails after the provider already created the KYC link (e.g. the DB update
        // throws, or a resend/retry replays this same claim), the provider treats a retry with
        // the same key as the original request and returns the existing resource instead of
        // minting a second one.
        idempotencyKey: `bank-confirm:${claims.jti}`,
        entityType: claims.entityType,
        legalName: claims.legalName,
        contactEmail: claims.contactEmail,
        requestedRails: claims.requestedRails,
        redirectUri: claims.redirectUri,
        onboardingFields: claims.onboardingFields,
      },
      { db },
      resolvedOptions,
    );
  } catch (error) {
    // Restore the nonce so this same confirmation link (or a resend) can still complete the row
    // instead of leaving it permanently stuck: not pending (jwt_nonce null) but not confirmed
    // either. Conditioned on jwt_nonce still being NULL (same recheck as the success path) — if a
    // resend already rotated it while the provider call was failing, this is a no-op rather than
    // clobbering the resend's new nonce.
    await releaseBankCustomerClaim(
      { id: claimed.id, restoreNonce: claims.jti },
      { db },
    );
    throw error;
  }

  if (!result) {
    // A resend rotated jwt_nonce while the provider call was in flight (D3): the row has already
    // moved on to a new link. Don't report success for one that's no longer live — the resent
    // link's own confirmation will complete normally, and Bridge's email-based dedup (D7/D8)
    // means it lands on the same customer this call may have just created, so nothing is lost.
    return { ok: false, reason: 'invalid' };
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
