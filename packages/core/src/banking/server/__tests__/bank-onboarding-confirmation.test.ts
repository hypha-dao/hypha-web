import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

process.env.INTERNAL_JWT_SECRET = 'test-secret-at-least-32-bytes-long!!';

import {
  confirmBankEmail,
  requestBankOnboardingWithConfirmation,
  type BankOnboardingOwnerRef,
} from '../bank-onboarding-confirmation';
import type { BankKycProvider } from '../providers/types';
import { signBankConfirmationJwt } from '../../../common/server/sign-bank-confirmation-jwt';

const findBankCustomerBySpaceAndProvider = vi.fn();
const findBankCustomerByPersonAndProvider = vi.fn();
const findBankCustomerByNonce = vi.fn();
const insertBankCustomer = vi.fn();
const updateBankCustomer = vi.fn();
const claimBankCustomerForConfirmation = vi.fn();
const finalizeClaimedBankCustomer = vi.fn();
const releaseBankCustomerClaim = vi.fn();
const bridgeGetKycLink = vi.fn();
const bridgeFindCustomerByEmail = vi.fn();

vi.mock('../queries', () => ({
  findBankCustomerBySpaceAndProvider: (...args: unknown[]) =>
    findBankCustomerBySpaceAndProvider(...args),
  findBankCustomerByPersonAndProvider: (...args: unknown[]) =>
    findBankCustomerByPersonAndProvider(...args),
  findBankCustomerByNonce: (...args: unknown[]) =>
    findBankCustomerByNonce(...args),
}));

vi.mock('../mutations', () => ({
  insertBankCustomer: (...args: unknown[]) => insertBankCustomer(...args),
  updateBankCustomer: (...args: unknown[]) => updateBankCustomer(...args),
  claimBankCustomerForConfirmation: (...args: unknown[]) =>
    claimBankCustomerForConfirmation(...args),
  finalizeClaimedBankCustomer: (...args: unknown[]) =>
    finalizeClaimedBankCustomer(...args),
  releaseBankCustomerClaim: (...args: unknown[]) =>
    releaseBankCustomerClaim(...args),
}));

vi.mock('../../../common/server/bridge-client', async () => {
  const actual = await vi.importActual<
    typeof import('../../../common/server/bridge-client')
  >('../../../common/server/bridge-client');
  return {
    ...actual,
    bridgeGetKycLink: (...args: unknown[]) => bridgeGetKycLink(...args),
    bridgeFindCustomerByEmail: (...args: unknown[]) =>
      bridgeFindCustomerByEmail(...args),
  };
});

const mockDb = {} as never;

const mockProvider: BankKycProvider = {
  provider: 'bridge',
  provisionVirtualAccount: vi.fn(),
  createTransfer: vi.fn(),
  registerExternalAccount: vi.fn(),
  createLiquidationAddress: vi.fn(),
  createKycLink: vi.fn().mockResolvedValue({
    providerCustomerId: 'cust_1',
    providerKycLinkId: 'link_1',
    kycStatus: 'not_started',
    isApproved: false,
    tosStatus: 'pending',
    kycLink: 'https://bridge.example/kyc',
    tosLink: 'https://bridge.example/tos',
  }),
};

const spaceOwner: BankOnboardingOwnerRef = {
  type: 'space',
  id: 1,
  slug: 'acme',
  label: 'Acme',
};

const sendConfirmationEmail = vi.fn().mockResolvedValue(undefined);

describe('requestBankOnboardingWithConfirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    findBankCustomerBySpaceAndProvider.mockResolvedValue(null);
    insertBankCustomer.mockResolvedValue({ id: 1 });
    sendConfirmationEmail.mockClear();
  });

  it('creates directly when the submitter is the email owner (bypass, D5)', async () => {
    const result = await requestBankOnboardingWithConfirmation(
      {
        ownerRef: spaceOwner,
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'me+sandbox@example.com',
        requestedRails: ['eur'],
        submitterPersonId: 10,
        submitterEmail: 'me@example.com',
        sendConfirmationEmail,
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.kind).toBe('created');
    expect(mockProvider.createKycLink).toHaveBeenCalledWith(
      expect.objectContaining({ contactEmail: 'me+sandbox@example.com' }),
    );
    expect(sendConfirmationEmail).not.toHaveBeenCalled();
    expect(insertBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ spaceId: 1, providerKycLinkId: 'link_1' }),
      expect.any(Object),
    );
  });

  it('signs a JWT and sends a confirmation email when the submitter is not the email owner', async () => {
    const result = await requestBankOnboardingWithConfirmation(
      {
        ownerRef: spaceOwner,
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        requestedRails: ['eur'],
        submitterPersonId: 10,
        submitterEmail: 'me@example.com',
        sendConfirmationEmail,
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.kind).toBe('pendingConfirmation');
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
    expect(sendConfirmationEmail).toHaveBeenCalledTimes(1);
    const sentArg = sendConfirmationEmail.mock.calls[0][0];
    expect(sentArg.ownerLabel).toBe('Acme');
    expect(sentArg.contactEmail).toBe('compliance@acme.org');
    expect(typeof sentArg.token).toBe('string');
    expect(insertBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({
        spaceId: 1,
        providerKycLinkId: null,
        providerCustomerId: null,
        jwtNonce: expect.any(String),
      }),
      expect.any(Object),
    );
  });

  it('never includes the confirmation token in the returned result', async () => {
    const result = await requestBankOnboardingWithConfirmation(
      {
        ownerRef: spaceOwner,
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        submitterPersonId: 10,
        submitterEmail: 'me@example.com',
        sendConfirmationEmail,
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(JSON.stringify(result)).not.toContain('eyJ'); // no JWT-looking substring
    expect('confirmationToken' in result).toBe(false);
  });

  it('returns existing status without calling the provider when already linked (idempotent)', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      id: 1,
      providerKycLinkId: 'link_1',
      providerCustomerId: 'cust_1',
      requestedRails: ['eur'],
      jwtNonce: null,
    });
    bridgeGetKycLink.mockResolvedValue({
      id: 'link_1',
      customer_id: 'cust_1',
      kyc_link: 'https://bridge.example/kyc',
      kyc_status: 'under_review',
    });

    const result = await requestBankOnboardingWithConfirmation(
      {
        ownerRef: spaceOwner,
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        submitterPersonId: 10,
        submitterEmail: 'me@example.com',
        sendConfirmationEmail,
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.kind).toBe('existing');
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
    expect(insertBankCustomer).not.toHaveBeenCalled();
  });

  it('claims and finalizes an existing pending row on bypass instead of inserting a duplicate', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      id: 7,
      providerKycLinkId: null,
      providerCustomerId: null,
      jwtNonce: 'old-nonce',
      requestedRails: ['eur'],
    });
    claimBankCustomerForConfirmation.mockResolvedValue({ id: 7 });
    finalizeClaimedBankCustomer.mockResolvedValue({ id: 7 });

    const result = await requestBankOnboardingWithConfirmation(
      {
        ownerRef: spaceOwner,
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'me+sandbox@example.com',
        requestedRails: ['eur'],
        submitterPersonId: 10,
        submitterEmail: 'me@example.com',
        sendConfirmationEmail,
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.kind).toBe('created');
    expect(insertBankCustomer).not.toHaveBeenCalled();
    expect(claimBankCustomerForConfirmation).toHaveBeenCalledWith(
      { id: 7, expectedNonce: 'old-nonce' },
      expect.any(Object),
    );
    expect(finalizeClaimedBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 7, providerKycLinkId: 'link_1' }),
      expect.any(Object),
    );
  });

  it('rejects a bypass request when the row is already claimed by an in-flight confirmation', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      id: 7,
      providerKycLinkId: null,
      providerCustomerId: null,
      jwtNonce: null,
      requestedRails: ['eur'],
    });

    await expect(
      requestBankOnboardingWithConfirmation(
        {
          ownerRef: spaceOwner,
          entityType: 'business',
          legalName: 'Acme Foundation Ltd.',
          contactEmail: 'me+sandbox@example.com',
          requestedRails: ['eur'],
          submitterPersonId: 10,
          submitterEmail: 'me@example.com',
          sendConfirmationEmail,
        },
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toThrow(/already being processed/i);
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
    expect(claimBankCustomerForConfirmation).not.toHaveBeenCalled();
  });

  it('rejects a bypass request that loses the claim to a concurrent resend or confirm', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      id: 7,
      providerKycLinkId: null,
      providerCustomerId: null,
      jwtNonce: 'old-nonce',
      requestedRails: ['eur'],
    });
    claimBankCustomerForConfirmation.mockResolvedValue(null);

    await expect(
      requestBankOnboardingWithConfirmation(
        {
          ownerRef: spaceOwner,
          entityType: 'business',
          legalName: 'Acme Foundation Ltd.',
          contactEmail: 'me+sandbox@example.com',
          requestedRails: ['eur'],
          submitterPersonId: 10,
          submitterEmail: 'me@example.com',
          sendConfirmationEmail,
        },
        { db: mockDb },
        { kycProvider: mockProvider },
      ),
    ).rejects.toThrow(/just changed/i);
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
  });

  it('rotates the nonce and clears any in-flight claim on resend instead of inserting a duplicate', async () => {
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      id: 1,
      providerKycLinkId: null,
      providerCustomerId: null,
      jwtNonce: 'old-nonce',
      requestedRails: ['eur'],
    });

    const result = await requestBankOnboardingWithConfirmation(
      {
        ownerRef: spaceOwner,
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        submitterPersonId: 10,
        submitterEmail: 'me@example.com',
        sendConfirmationEmail,
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.kind).toBe('pendingConfirmation');
    expect(insertBankCustomer).not.toHaveBeenCalled();
    expect(updateBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, jwtNonce: expect.any(String) }),
      expect.any(Object),
    );
    const newNonce = updateBankCustomer.mock.calls[0][0].jwtNonce;
    expect(newNonce).not.toBe('old-nonce');
  });

  it('updates (not inserts) on resend even while a confirm has the row claimed', async () => {
    // Simulates the claimed window: a confirm claimed the row (jwtNonce -> null, per
    // claimBankCustomerForConfirmation) but hasn't finalized providerKycLinkId yet.
    findBankCustomerBySpaceAndProvider.mockResolvedValue({
      id: 1,
      providerKycLinkId: null,
      providerCustomerId: null,
      jwtNonce: null,
      requestedRails: ['eur'],
    });

    const result = await requestBankOnboardingWithConfirmation(
      {
        ownerRef: spaceOwner,
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        submitterPersonId: 10,
        submitterEmail: 'me@example.com',
        sendConfirmationEmail,
      },
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.kind).toBe('pendingConfirmation');
    expect(insertBankCustomer).not.toHaveBeenCalled();
    expect(updateBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, jwtNonce: expect.any(String) }),
      expect.any(Object),
    );
  });
});

describe('confirmBankEmail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridgeFindCustomerByEmail.mockResolvedValue(null);
    // Default: the compare-and-swap claim succeeds (row still matches the nonce being confirmed).
    claimBankCustomerForConfirmation.mockImplementation(
      async ({ id }: { id: number; expectedNonce: string }) => ({
        id,
        jwtNonce: null,
        providerKycLinkId: null,
      }),
    );
    // Default: the final CAS write succeeds (nothing revoked the claim in the meantime).
    finalizeClaimedBankCustomer.mockImplementation(
      async (input: {
        id: number;
        providerCustomerId: string | null;
        providerKycLinkId: string;
        requestedRails: string[];
      }) => ({
        id: input.id,
        providerCustomerId: input.providerCustomerId,
        providerKycLinkId: input.providerKycLinkId,
        requestedRails: input.requestedRails,
      }),
    );
  });

  async function signAndStorePending(nonce?: string) {
    const signed = await signBankConfirmationJwt({
      ownerType: 'space',
      ownerId: 1,
      ownerSlug: 'acme',
      ownerLabel: 'Acme',
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      requestedRails: ['eur'],
      submitterPersonId: 10,
    });
    findBankCustomerByNonce.mockResolvedValue({
      id: 1,
      jwtNonce: nonce ?? signed.nonce,
      providerKycLinkId: null,
    });
    return signed.token;
  }

  it('finalizes a pending row and calls the Bridge pre-check (informational, D7)', async () => {
    const token = await signAndStorePending();
    bridgeFindCustomerByEmail.mockResolvedValue({
      id: 'existing_cust',
      type: 'business',
    });

    const result = await confirmBankEmail(
      token,
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.existingBridgeCustomer).toEqual({
        id: 'existing_cust',
        type: 'business',
      });
      expect(result.ownerLabel).toBe('Acme');
    }
    expect(mockProvider.createKycLink).toHaveBeenCalled();
    expect(finalizeClaimedBankCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ id: 1, providerKycLinkId: 'link_1' }),
      expect.any(Object),
    );
  });

  it('rejects an invalid token', async () => {
    const result = await confirmBankEmail(
      'not-a-real-token',
      { db: mockDb },
      { kycProvider: mockProvider },
    );
    expect(result).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects when the nonce no longer matches (rotated by a resend, D3)', async () => {
    const token = await signAndStorePending('a-different-current-nonce');

    const result = await confirmBankEmail(
      token,
      { db: mockDb },
      { kycProvider: mockProvider },
    );
    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
  });

  it('rejects a concurrent confirm that loses the compare-and-swap claim', async () => {
    const token = await signAndStorePending();
    // Simulates a second in-flight confirm of the same token: the row is already claimed by the
    // first request (jwt_nonce already cleared, so this claim's WHERE no longer matches).
    claimBankCustomerForConfirmation.mockResolvedValue(null);

    const result = await confirmBankEmail(
      token,
      { db: mockDb },
      { kycProvider: mockProvider },
    );
    expect(result).toEqual({ ok: false, reason: 'invalid' });
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
  });

  it('rejects (without throwing) when a resend revokes this claim while the provider call is in flight', async () => {
    const token = await signAndStorePending();
    // Simulates: claim succeeded (jwt_nonce -> null), but a resend rotated jwt_nonce to a new
    // value before the final write — finalizeClaimedBankCustomer's CAS then matches 0 rows and
    // returns null.
    finalizeClaimedBankCustomer.mockResolvedValue(null);

    const result = await confirmBankEmail(
      token,
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    expect(result).toEqual({ ok: false, reason: 'invalid' });
    // The provider call itself still happened (and, per D7/D8, Bridge's own email-based dedup
    // means the resent link's eventual confirmation lands on the same customer) — what matters is
    // that this superseded attempt doesn't report success or corrupt the row.
    expect(mockProvider.createKycLink).toHaveBeenCalled();
    // No restoration write here: nothing threw, so the failure-recovery path never runs — a
    // resend already moved the row on, and there's nothing to release or restore.
    expect(updateBankCustomer).not.toHaveBeenCalled();
    expect(releaseBankCustomerClaim).not.toHaveBeenCalled();
  });

  it('uses a stable per-token idempotency key so a retried finalize replays instead of duplicating', async () => {
    const token = await signAndStorePending();

    await confirmBankEmail(
      token,
      { db: mockDb },
      { kycProvider: mockProvider },
    );
    await confirmBankEmail(
      token,
      { db: mockDb },
      { kycProvider: mockProvider },
    );

    const keys = (
      mockProvider.createKycLink as ReturnType<typeof vi.fn>
    ).mock.calls.map(([arg]) => arg.idempotencyKey);
    expect(keys).toHaveLength(2);
    expect(keys[0]).toBe(keys[1]);
  });

  it('releases the claim if the provider call fails, so a retry or resend can proceed', async () => {
    const token = await signAndStorePending();
    (
      mockProvider.createKycLink as ReturnType<typeof vi.fn>
    ).mockRejectedValueOnce(new Error('bridge down'));

    await expect(
      confirmBankEmail(token, { db: mockDb }, { kycProvider: mockProvider }),
    ).rejects.toThrow('bridge down');

    expect(releaseBankCustomerClaim).toHaveBeenCalledWith(
      { id: 1, restoreNonce: expect.any(String) },
      expect.any(Object),
    );
  });

  it('rejects an already-confirmed row', async () => {
    const { token, nonce } = await signBankConfirmationJwt({
      ownerType: 'space',
      ownerId: 1,
      ownerSlug: 'acme',
      ownerLabel: 'Acme',
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      requestedRails: [],
      submitterPersonId: 10,
    });
    findBankCustomerByNonce.mockResolvedValue({
      id: 1,
      jwtNonce: nonce,
      providerKycLinkId: 'already-linked',
    });

    const result = await confirmBankEmail(
      token,
      { db: mockDb },
      { kycProvider: mockProvider },
    );
    expect(result).toEqual({ ok: false, reason: 'already_confirmed' });
    expect(mockProvider.createKycLink).not.toHaveBeenCalled();
  });
});
