import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const auddExchangeToken = vi.fn();
const auddCreateCustomer = vi.fn();
const auddSubmitKyc = vi.fn();
const auddListCustomers = vi.fn();

vi.mock('../audd-client', async () => {
  const actual = await vi.importActual<typeof import('../audd-client')>(
    '../audd-client',
  );
  return {
    ...actual,
    auddExchangeToken: (...args: unknown[]) => auddExchangeToken(...args),
    auddCreateCustomer: (...args: unknown[]) => auddCreateCustomer(...args),
    auddSubmitKyc: (...args: unknown[]) => auddSubmitKyc(...args),
    auddListCustomers: (...args: unknown[]) => auddListCustomers(...args),
  };
});

import { BankOnboardingError } from '../../../errors';
import type { CreateKycLinkInput } from '../../types';
import { createAuddIdentityProvider } from '../adapter';

const TOKEN = {
  accessToken: 'jwt-access',
  tokenType: 'Bearer',
  expiresIn: 300,
  scope: 'customer.read customer.write',
};

function individualInput(
  overrides: Partial<Record<string, string>> = {},
): CreateKycLinkInput {
  return {
    entityType: 'individual',
    legalName: 'Jane Doe',
    contactEmail: 'jane@example.com',
    idempotencyKey: 'idem-key-seed-0001',
    onboardingFields: {
      firstName: 'Jane',
      lastName: 'Doe',
      phoneNumber: '+61400000000',
      dateOfBirth: '01/02/1990',
      addressLine1: '1 Test St',
      suburb: 'Testville',
      postcode: '2000',
      state: 'NSW',
      country: 'AUS',
      companyType: 'INDIVIDUAL',
      ...overrides,
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.AUDD_GATEWAY_TIER_ID = '07bbac7c-tier-2';
  delete process.env.AUDD_GATEWAY_MERCHANT_GROUP_ID;
  auddExchangeToken.mockResolvedValue(TOKEN);
  auddCreateCustomer.mockResolvedValue({ id: 'cust_123' });
  auddSubmitKyc.mockResolvedValue({
    customerId: 'cust_123',
    kycStatus: 'PENDING',
    submittedAt: '2026-09-07T12:00:00.000Z',
    verificationUrl: 'https://verify.audd.example/abc',
  });
});

afterEach(() => {
  delete process.env.AUDD_GATEWAY_TIER_ID;
});

describe('createAuddIdentityProvider — createKycLink', () => {
  it('runs create-customer then submit-KYC and returns the hosted link', async () => {
    const provider = createAuddIdentityProvider();
    const result = await provider.createKycLink(individualInput());

    expect(result).toEqual({
      providerCustomerId: 'cust_123',
      providerKycLinkId: 'cust_123',
      kycStatus: 'PENDING',
      isApproved: false,
      tosStatus: null,
      kycLink: 'https://verify.audd.example/abc',
      tosLink: null,
    });

    const [body, auth] = auddCreateCustomer.mock.calls[0];
    expect(body).toMatchObject({
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phoneNumber: '+61400000000',
      dateOfBirth: '01/02/1990',
      country: 'AUS',
      companyType: 'INDIVIDUAL',
    });
    expect(body.merchantGroupId).toBeUndefined();

    const [customerId, kycBody, kycAuth] = auddSubmitKyc.mock.calls[0];
    expect(customerId).toBe('cust_123');
    expect(kycBody).toEqual({ tierId: '07bbac7c-tier-2' });

    // Idempotency keys: exactly 32 chars, and distinct for the two writes.
    expect(auth.idempotencyKey).toHaveLength(32);
    expect(kycAuth.idempotencyKey).toHaveLength(32);
    expect(auth.idempotencyKey).not.toBe(kycAuth.idempotencyKey);
  });

  it('passes merchantGroupId when AUDD_GATEWAY_MERCHANT_GROUP_ID is set', async () => {
    process.env.AUDD_GATEWAY_MERCHANT_GROUP_ID = '6b8c5544-group';
    const provider = createAuddIdentityProvider();
    await provider.createKycLink(individualInput());
    expect(auddCreateCustomer.mock.calls[0][0].merchantGroupId).toBe(
      '6b8c5544-group',
    );
  });

  it('throws a 400 listing missing required fields, before any API call', async () => {
    const provider = createAuddIdentityProvider();
    const input = individualInput();
    delete input.onboardingFields!.phoneNumber;
    delete input.onboardingFields!.postcode;

    await expect(provider.createKycLink(input)).rejects.toMatchObject({
      name: 'BankOnboardingError',
      status: 400,
    });
    await expect(provider.createKycLink(input)).rejects.toThrow(/phoneNumber/);
    expect(auddExchangeToken).not.toHaveBeenCalled();
    expect(auddCreateCustomer).not.toHaveBeenCalled();
  });

  it('rejects a business entity with no companyType', async () => {
    const provider = createAuddIdentityProvider();
    const input = individualInput({ companyType: '' });
    input.entityType = 'business';

    await expect(provider.createKycLink(input)).rejects.toBeInstanceOf(
      BankOnboardingError,
    );
    expect(auddCreateCustomer).not.toHaveBeenCalled();
  });

  it('requires registrationNumber + companyBusinessName for PRIVATE_COMPANY', async () => {
    const provider = createAuddIdentityProvider();
    const input = individualInput({ companyType: 'PRIVATE_COMPANY' });
    input.entityType = 'business';

    await expect(provider.createKycLink(input)).rejects.toThrow(
      /registrationNumber.*companyBusinessName|companyBusinessName.*registrationNumber/,
    );

    const ok = individualInput({
      companyType: 'PRIVATE_COMPANY',
      registrationNumber: 'ABN123',
      companyBusinessName: 'Acme Pty Ltd',
    });
    ok.entityType = 'business';
    await expect(provider.createKycLink(ok)).resolves.toMatchObject({
      providerCustomerId: 'cust_123',
    });
  });

  it('throws when AUDD_GATEWAY_TIER_ID is not configured', async () => {
    delete process.env.AUDD_GATEWAY_TIER_ID;
    const provider = createAuddIdentityProvider();
    await expect(
      provider.createKycLink(individualInput()),
    ).rejects.toMatchObject({ status: 500 });
    expect(auddCreateCustomer).not.toHaveBeenCalled();
  });

  it('maps an AUDD 403 to a BankOnboardingError(403)', async () => {
    auddCreateCustomer.mockRejectedValueOnce(
      Object.assign(new Error('AUDD Gateway API error (403): ...'), {
        status: 403,
        body: { message: 'forbidden', messageKey: 'ip.not_allowed' },
      }),
    );
    const provider = createAuddIdentityProvider();
    await expect(
      provider.createKycLink(individualInput()),
    ).rejects.toMatchObject({ name: 'BankOnboardingError', status: 403 });
  });
});

describe('createAuddIdentityProvider — getKycStatus', () => {
  it('returns null when the row has no provider customer id yet', async () => {
    const provider = createAuddIdentityProvider();
    const result = await provider.getKycStatus({
      customer: {
        provider: 'audd',
        providerKycLinkId: null,
        providerCustomerId: null,
      },
    });
    expect(result).toBeNull();
    expect(auddExchangeToken).not.toHaveBeenCalled();
  });

  it('bucket-probes and reports APPROVED as approved', async () => {
    auddListCustomers.mockImplementation(
      async ({ kycStatus }: { kycStatus: string }) =>
        kycStatus === 'APPROVED'
          ? { items: [{ id: 'cust_123' }], total: 1 }
          : { items: [], total: 0 },
    );

    const provider = createAuddIdentityProvider();
    const result = await provider.getKycStatus({
      customer: {
        provider: 'audd',
        providerKycLinkId: 'cust_123',
        providerCustomerId: 'cust_123',
      },
    });

    expect(result).toEqual({
      kycStatus: 'APPROVED',
      isApproved: true,
      tosStatus: null,
      kycLink: null,
    });
  });

  it('falls back to PENDING when the customer is in no probed bucket', async () => {
    auddListCustomers.mockResolvedValue({ items: [], total: 0 });
    const provider = createAuddIdentityProvider();
    const result = await provider.getKycStatus({
      customer: {
        provider: 'audd',
        providerKycLinkId: 'cust_123',
        providerCustomerId: 'cust_123',
      },
    });
    expect(result).toEqual({
      kycStatus: 'PENDING',
      isApproved: false,
      tosStatus: null,
      kycLink: null,
    });
  });

  it('paginates past a full first page to find a customer on a later page', async () => {
    const fullPage = Array.from({ length: 100 }, (_, i) => ({ id: `c${i}` }));
    auddListCustomers.mockImplementation(
      async ({ kycStatus, index }: { kycStatus: string; index?: number }) => {
        if (kycStatus !== 'APPROVED') {
          return { items: [], total: 0 };
        }
        if ((index ?? 0) === 0) {
          return { items: fullPage, total: 101 };
        }
        return { items: [{ id: 'cust_123' }], total: 101 };
      },
    );

    const provider = createAuddIdentityProvider();
    const result = await provider.getKycStatus({
      customer: {
        provider: 'audd',
        providerKycLinkId: 'cust_123',
        providerCustomerId: 'cust_123',
      },
    });

    expect(result?.kycStatus).toBe('APPROVED');
    expect(result?.isApproved).toBe(true);
    // Two pages for APPROVED (100 then the 101st) before it can move to the next status.
    expect(auddListCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ kycStatus: 'APPROVED', index: 0 }),
      undefined,
    );
    expect(auddListCustomers).toHaveBeenCalledWith(
      expect.objectContaining({ kycStatus: 'APPROVED', index: 100 }),
      undefined,
    );
  });
});

describe('createAuddIdentityProvider — getOnboardingStepDescriptor', () => {
  it('describes the external KYC link step', () => {
    const provider = createAuddIdentityProvider();
    expect(
      provider.getOnboardingStepDescriptor({
        kycLink: 'https://verify.audd.example/abc',
      }),
    ).toEqual({
      kind: 'external_kyc_link',
      url: 'https://verify.audd.example/abc',
      i18nKeys: {
        title: 'BankingTab.onboardingSteps.kyc.title',
        body: 'BankingTab.onboardingSteps.kyc.body',
      },
    });
  });
});
