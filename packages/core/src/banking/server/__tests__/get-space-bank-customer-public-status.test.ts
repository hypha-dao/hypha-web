import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const findBankCustomersBySpace = vi.fn();
const getBankIdentityProvider = vi.fn();
const loadBankingProviderState = vi.fn();
const buildCustomerValidations = vi.fn();
const buildRailStatuses = vi.fn();
const resolveCustomerApproved = vi.fn();
const extractCustomerMissingFlags = vi.fn();

vi.mock('../queries', () => ({
  findBankCustomerBySpaceAndProvider: vi.fn(),
  findBankCustomersBySpace: (...args: unknown[]) =>
    findBankCustomersBySpace(...args),
}));

vi.mock('../providers/registry', () => ({
  getBankIdentityProvider: (...args: unknown[]) =>
    getBankIdentityProvider(...args),
}));

vi.mock('../providers/bridge/banking-provider-state', () => ({
  loadBankingProviderState: (...args: unknown[]) =>
    loadBankingProviderState(...args),
  buildCustomerValidations: (...args: unknown[]) =>
    buildCustomerValidations(...args),
  buildRailStatuses: (...args: unknown[]) => buildRailStatuses(...args),
  resolveCustomerApproved: (...args: unknown[]) =>
    resolveCustomerApproved(...args),
}));

vi.mock('../bridge-customer-endorsements', () => ({
  extractCustomerMissingFlags: (...args: unknown[]) =>
    extractCustomerMissingFlags(...args),
}));

import {
  buildPublicStatusFromCustomer,
  getBankCustomerPublicStatuses,
  getSpaceBankCustomerPublicStatuses,
} from '../get-space-bank-customer-public-status';

const mockDb = {} as never;

function bridgeCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    spaceId: 10,
    personId: null,
    entityType: 'business',
    provider: 'bridge',
    providerCustomerId: 'cust_bridge',
    providerKycLinkId: 'link_bridge',
    requestedRails: ['eur'],
    ...overrides,
  } as never;
}

function auddCustomer(overrides: Record<string, unknown> = {}) {
  return {
    id: 2,
    spaceId: 10,
    personId: null,
    entityType: 'individual',
    provider: 'audd',
    providerCustomerId: 'cust_audd',
    providerKycLinkId: 'link_audd',
    requestedRails: ['aud'],
    ...overrides,
  } as never;
}

describe('getBankCustomerPublicStatuses (D11 — multi-provider status)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    extractCustomerMissingFlags.mockReturnValue({
      sofMissing: false,
      pendingUbos: [],
    });
    loadBankingProviderState.mockResolvedValue({
      kycLink: { kyc_link: 'https://bridge.example/kyc' },
      customer: { status: 'active', endorsements: [], associated_persons: [] },
    });
    buildCustomerValidations.mockReturnValue({
      tos: { key: 'tos', status: 'approved', isComplete: true },
      kyc: { key: 'kyc', status: 'approved', isComplete: true },
    });
    buildRailStatuses.mockReturnValue([]);
    resolveCustomerApproved.mockResolvedValue(true);
  });

  it('an owner with a Bridge row + an AUDD row gets a per-provider entry for each', async () => {
    getBankIdentityProvider.mockReturnValue({
      getKycStatus: vi.fn().mockResolvedValue({
        kycStatus: 'PENDING',
        isApproved: false,
        tosStatus: null,
        kycLink: null,
      }),
      getOnboardingStepDescriptor: vi.fn(),
    });

    const results = await getBankCustomerPublicStatuses(
      [bridgeCustomer(), auddCustomer()],
      { db: mockDb },
    );

    expect(results).toHaveLength(2);
    expect(results[0]?.provider).toBe('bridge');
    expect(results[0]?.isApproved).toBe(true);
    expect(results[1]?.provider).toBe('audd');
    expect(results[1]?.isApproved).toBe(false);
    expect(results[1]?.procedures.tos).toBeNull();
    expect(results[1]?.railStatuses).toEqual([]);
  });

  it('routes Bridge rows through buildPublicStatusFromCustomer unchanged', async () => {
    getBankIdentityProvider.mockReturnValue({
      getKycStatus: vi.fn(),
      getOnboardingStepDescriptor: vi.fn(),
    });

    const [viaHelper] = await getBankCustomerPublicStatuses(
      [bridgeCustomer()],
      { db: mockDb },
    );
    const direct = await buildPublicStatusFromCustomer(bridgeCustomer(), {
      db: mockDb,
    });

    expect(viaHelper).toEqual(direct);
    expect(getBankIdentityProvider).not.toHaveBeenCalled();
  });

  it('an identity-only row pending #2288 email confirmation has no provider resource yet', async () => {
    const results = await getBankCustomerPublicStatuses(
      [auddCustomer({ providerCustomerId: null, providerKycLinkId: null })],
      { db: mockDb },
    );

    expect(results[0]).toMatchObject({
      provider: 'audd',
      hasCustomer: true,
      isApproved: false,
      procedures: { tos: null, kyc: { status: null, isComplete: false } },
      pendingEmailConfirmation: { requestedRails: ['aud'] },
    });
    expect(getBankIdentityProvider).not.toHaveBeenCalled();
  });

  it('an identity-only row with no provider-side KYC resource yet renders a null-status placeholder', async () => {
    getBankIdentityProvider.mockReturnValue({
      getKycStatus: vi.fn().mockResolvedValue(null),
      getOnboardingStepDescriptor: vi.fn(),
    });

    const results = await getBankCustomerPublicStatuses([auddCustomer()], {
      db: mockDb,
    });

    expect(results[0]?.isApproved).toBe(false);
    expect(results[0]?.procedures.kyc).toEqual({
      key: 'kyc',
      status: null,
      isComplete: false,
    });
  });

  it('D16: an approved identity-only row with no re-fetchable link renders with no action url', async () => {
    getBankIdentityProvider.mockReturnValue({
      getKycStatus: vi.fn().mockResolvedValue({
        kycStatus: 'APPROVED',
        isApproved: true,
        tosStatus: null,
        kycLink: null,
      }),
      getOnboardingStepDescriptor: vi.fn(),
    });

    const results = await getBankCustomerPublicStatuses([auddCustomer()], {
      db: mockDb,
    });

    expect(results[0]?.isApproved).toBe(true);
    expect(results[0]?.approvalRegistered).toBe(true);
    expect(results[0]?.procedures.kyc.action).toBeUndefined();
  });

  it('a pending identity-only row with a live kycLink surfaces the step descriptor url', async () => {
    getBankIdentityProvider.mockReturnValue({
      getKycStatus: vi.fn().mockResolvedValue({
        kycStatus: 'PENDING',
        isApproved: false,
        tosStatus: null,
        kycLink: 'https://audd.example/kyc/123',
      }),
      getOnboardingStepDescriptor: vi.fn().mockReturnValue({
        kind: 'external_kyc_link',
        url: 'https://audd.example/kyc/123',
        i18nKeys: { title: 'x' },
      }),
    });

    const results = await getBankCustomerPublicStatuses([auddCustomer()], {
      db: mockDb,
    });

    expect(results[0]?.procedures.kyc.action).toEqual({
      type: 'link',
      url: 'https://audd.example/kyc/123',
    });
  });
});

describe('getSpaceBankCustomerPublicStatuses', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('queries every bank_customers row for the space, not just Bridge', async () => {
    findBankCustomersBySpace.mockResolvedValue([]);

    const results = await getSpaceBankCustomerPublicStatuses(
      { id: 10, title: 'Test Space' },
      { db: mockDb },
    );

    expect(findBankCustomersBySpace).toHaveBeenCalledWith(10, { db: mockDb });
    expect(results).toEqual([]);
  });
});
