import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBridgeKycProvider } from '../adapter';

const bridgeCreateKycLink = vi.fn();
const bridgeCreateVirtualAccount = vi.fn();
const bridgeCreateTransfer = vi.fn();
const bridgeCreateExternalAccount = vi.fn();
const bridgeCreateLiquidationAddress = vi.fn();

vi.mock('../../../../../common/server/bridge-client', () => ({
  bridgeCreateKycLink: (...args: unknown[]) => bridgeCreateKycLink(...args),
  bridgeCreateVirtualAccount: (...args: unknown[]) =>
    bridgeCreateVirtualAccount(...args),
  bridgeCreateTransfer: (...args: unknown[]) => bridgeCreateTransfer(...args),
  bridgeCreateExternalAccount: (...args: unknown[]) =>
    bridgeCreateExternalAccount(...args),
  bridgeCreateLiquidationAddress: (...args: unknown[]) =>
    bridgeCreateLiquidationAddress(...args),
}));

describe('createBridgeKycProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    bridgeCreateKycLink.mockResolvedValue({
      id: 'kyc_link_1',
      customer_id: 'cust_1',
      kyc_link: 'https://bridge.example/kyc',
      tos_link: 'https://bridge.example/tos',
      kyc_status: 'not_started',
      tos_status: 'pending',
      created_at: '2026-05-18T00:00:00Z',
    });
  });

  it('maps business input with endorsements and redirectUri', async () => {
    const provider = createBridgeKycProvider();
    await provider.createKycLink({
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      endorsements: ['base', 'sepa'],
      redirectUri: 'https://app.hypha.earth/en/dho/acme/banking',
    });

    expect(bridgeCreateKycLink).toHaveBeenCalledWith(
      {
        full_name: 'Acme Foundation Ltd.',
        email: 'compliance@acme.org',
        type: 'business',
        endorsements: ['base', 'sepa'],
        redirect_uri: 'https://app.hypha.earth/en/dho/acme/banking',
      },
      '550e8400-e29b-41d4-a716-446655440000',
    );
  });

  it('sends default deposit-corridor endorsements when none provided', async () => {
    const provider = createBridgeKycProvider();
    await provider.createKycLink({
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });

    const [body] = bridgeCreateKycLink.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    expect(body.endorsements).toEqual(['base', 'sepa']);
    expect(body).not.toHaveProperty('redirect_uri');
  });

  it('omits redirect_uri when redirectUri is not provided', async () => {
    const provider = createBridgeKycProvider();
    await provider.createKycLink({
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      endorsements: ['sepa'],
    });

    const [body] = bridgeCreateKycLink.mock.calls[0] as [
      Record<string, unknown>,
      string,
    ];
    expect(body.endorsements).toEqual(['sepa']);
    expect(body).not.toHaveProperty('redirect_uri');
  });

  it('maps individual entityType to Bridge type individual', async () => {
    const provider = createBridgeKycProvider();
    await provider.createKycLink({
      entityType: 'individual',
      legalName: 'Jane Doe',
      contactEmail: 'jane@example.com',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(bridgeCreateKycLink).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'individual' }),
      expect.any(String),
    );
  });

  it('rejects endorsements that are not valid Bridge rails', async () => {
    const provider = createBridgeKycProvider();

    await expect(
      provider.createKycLink({
        entityType: 'business',
        legalName: 'Acme Foundation Ltd.',
        contactEmail: 'compliance@acme.org',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
        endorsements: ['not_a_bridge_rail'],
      }),
    ).rejects.toThrow();

    expect(bridgeCreateKycLink).not.toHaveBeenCalled();
  });

  it('maps providerCustomerId null when customer_id is absent on create', async () => {
    bridgeCreateKycLink.mockResolvedValueOnce({
      id: 'kyc_link_1',
      kyc_link: 'https://bridge.example/kyc',
      tos_link: 'https://bridge.example/tos',
      kyc_status: 'not_started',
      tos_status: 'pending',
      created_at: '2026-05-18T00:00:00Z',
    });

    const provider = createBridgeKycProvider();
    const result = await provider.createKycLink({
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.providerCustomerId).toBeNull();
  });

  it('rewrites tos_link redirect_uri to kyc_link after Bridge create', async () => {
    bridgeCreateKycLink.mockResolvedValueOnce({
      id: 'kyc_link_1',
      customer_id: 'cust_1',
      kyc_link:
        'https://bridge.example/kyc?redirect_uri=https%3A%2F%2Fapp.hypha.earth%2Freturn',
      tos_link:
        'https://bridge.example/tos?redirect_uri=https%3A%2F%2Fapp.hypha.earth%2Freturn',
      kyc_status: 'not_started',
      tos_status: 'pending',
      created_at: '2026-05-18T00:00:00Z',
    });

    const provider = createBridgeKycProvider();
    const result = await provider.createKycLink({
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
      redirectUri: 'https://app.hypha.earth/en/dho/acme/banking',
    });

    expect(result.kycLink).toContain('https://bridge.example/kyc');
    expect(result.tosLink).not.toBeNull();
    expect(new URL(result.tosLink!).searchParams.get('redirect_uri')).toBe(
      result.kycLink,
    );
  });

  it('maps tosLink null when response tos_link is absent', async () => {
    bridgeCreateKycLink.mockResolvedValueOnce({
      id: 'kyc_link_1',
      customer_id: 'cust_1',
      kyc_link: 'https://bridge.example/kyc',
      kyc_status: 'not_started',
      tos_status: 'pending',
      created_at: '2026-05-18T00:00:00Z',
    });

    const provider = createBridgeKycProvider();
    const result = await provider.createKycLink({
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.tosLink).toBeNull();
  });

  it('sets isApproved true when kyc_status is approved', async () => {
    bridgeCreateKycLink.mockResolvedValueOnce({
      id: 'kyc_link_1',
      customer_id: 'cust_1',
      kyc_link: 'https://bridge.example/kyc',
      kyc_status: 'approved',
      tos_status: 'approved',
      created_at: '2026-05-18T00:00:00Z',
    });

    const provider = createBridgeKycProvider();
    const result = await provider.createKycLink({
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.isApproved).toBe(true);
  });

  it('sets isApproved false when kyc_status is not approved', async () => {
    const provider = createBridgeKycProvider();
    const result = await provider.createKycLink({
      entityType: 'business',
      legalName: 'Acme Foundation Ltd.',
      contactEmail: 'compliance@acme.org',
      idempotencyKey: '550e8400-e29b-41d4-a716-446655440000',
    });

    expect(result.isApproved).toBe(false);
  });

  describe('provisionVirtualAccount', () => {
    beforeEach(() => {
      bridgeCreateVirtualAccount.mockResolvedValue({
        id: 'va_1',
        status: 'activated',
        source: { currency: 'eur', payment_rail: 'sepa' },
        source_deposit_instructions: {
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          bank_name: 'Bridge Bank',
        },
      });
    });

    it('calls Bridge with source currency and Base USDC destination', async () => {
      const provider = createBridgeKycProvider();
      await provider.provisionVirtualAccount({
        customerId: 'cust_1',
        currency: 'eur',
        destinationAddress: '0xtreasury',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440001',
      });

      expect(bridgeCreateVirtualAccount).toHaveBeenCalledWith(
        'cust_1',
        {
          source: { currency: 'eur' },
          destination: {
            payment_rail: 'base',
            currency: 'usdc',
            address: '0xtreasury',
          },
        },
        '550e8400-e29b-41d4-a716-446655440001',
      );
    });

    it('passes destinationCurrency when provided', async () => {
      const provider = createBridgeKycProvider();
      await provider.provisionVirtualAccount({
        customerId: 'cust_1',
        currency: 'eur',
        destinationAddress: '0xtreasury',
        destinationCurrency: 'eurc',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440005',
      });

      expect(bridgeCreateVirtualAccount).toHaveBeenCalledWith(
        'cust_1',
        expect.objectContaining({
          destination: expect.objectContaining({ currency: 'eurc' }),
        }),
        '550e8400-e29b-41d4-a716-446655440005',
      );
    });

    it('maps response to provider-agnostic result', async () => {
      const provider = createBridgeKycProvider();
      const result = await provider.provisionVirtualAccount({
        customerId: 'cust_1',
        currency: 'eur',
        destinationAddress: '0xtreasury',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440001',
      });

      expect(result).toEqual({
        providerVirtualAccountId: 'va_1',
        currency: 'eur',
        paymentRail: 'sepa',
        depositInstructions: {
          iban: 'DE89370400440532013000',
          bic: 'COBADEFFXXX',
          bank_name: 'Bridge Bank',
        },
        destination: {
          currency: 'usdc',
          paymentRail: 'base',
          address: '0xtreasury',
        },
        developerFeePercent: null,
        status: 'activated',
      });
    });

    it('maps sandbox response with currency on source_deposit_instructions only', async () => {
      bridgeCreateVirtualAccount.mockResolvedValueOnce({
        id: '5132d8b5-02c3-4436-8290-835b8157d180',
        status: 'activated',
        customer_id: 'cust_1',
        source_deposit_instructions: {
          currency: 'eur',
          iban: 'LU204080000025759864',
          bic: 'BCIRLULL',
          bank_name: 'Banking Circle S.A.',
          payment_rails: ['sepa'],
        },
        destination: {
          currency: 'usdc',
          payment_rail: 'base',
          address: '0xtreasury',
        },
      });

      const provider = createBridgeKycProvider();
      const result = await provider.provisionVirtualAccount({
        customerId: 'cust_1',
        currency: 'eur',
        destinationAddress: '0xtreasury',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440004',
      });

      expect(result).toEqual({
        providerVirtualAccountId: '5132d8b5-02c3-4436-8290-835b8157d180',
        currency: 'eur',
        paymentRail: 'sepa',
        depositInstructions: expect.objectContaining({
          iban: 'LU204080000025759864',
          payment_rails: ['sepa'],
        }),
        destination: {
          currency: 'usdc',
          paymentRail: 'base',
          address: '0xtreasury',
        },
        developerFeePercent: null,
        status: 'activated',
      });
    });

    it('falls back to currency map when payment_rail is absent on response', async () => {
      bridgeCreateVirtualAccount.mockResolvedValueOnce({
        id: 'va_2',
        status: 'activated',
        source: { currency: 'usd' },
        source_deposit_instructions: {
          bank_routing_number: '021000021',
          bank_account_number: '123456789',
        },
      });

      const provider = createBridgeKycProvider();
      const result = await provider.provisionVirtualAccount({
        customerId: 'cust_1',
        currency: 'usd',
        destinationAddress: '0xtreasury',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440002',
      });

      expect(result.paymentRail).toBe('ach');
    });

    it('rejects unsupported currency before calling Bridge', async () => {
      const provider = createBridgeKycProvider();

      await expect(
        provider.provisionVirtualAccount({
          customerId: 'cust_1',
          currency: 'kes',
          destinationAddress: '0xtreasury',
          idempotencyKey: '550e8400-e29b-41d4-a716-446655440003',
        }),
      ).rejects.toThrow(/Unsupported virtual account currency/);

      expect(bridgeCreateVirtualAccount).not.toHaveBeenCalled();
    });
  });

  describe('createTransfer', () => {
    beforeEach(() => {
      bridgeCreateTransfer.mockResolvedValue({
        id: 'transfer_1',
        state: 'awaiting_funds',
        on_behalf_of: 'cust_1',
        amount: null,
        source: { payment_rail: 'ach_push', currency: 'usd' },
        destination: {
          payment_rail: 'base',
          currency: 'usdc',
          to_address: '0xtreasury',
        },
        source_deposit_instructions: {
          bank_account_number: '123456789',
          bank_routing_number: '101019644',
          currency: 'usd',
          deposit_message: 'BRG7depositmessage',
        },
      });
    });

    it('calls Bridge with flexible_amount when amount is omitted', async () => {
      const provider = createBridgeKycProvider();
      await provider.createTransfer({
        customerId: 'cust_1',
        currency: 'usd',
        paymentRail: 'ach_push',
        destinationAddress: '0xtreasury',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440010',
      });

      expect(bridgeCreateTransfer).toHaveBeenCalledWith(
        {
          on_behalf_of: 'cust_1',
          source: { payment_rail: 'ach_push', currency: 'usd' },
          destination: {
            payment_rail: 'base',
            currency: 'usdc',
            to_address: '0xtreasury',
          },
          features: { flexible_amount: true },
          developer_fee_percent: '0.0',
        },
        '550e8400-e29b-41d4-a716-446655440010',
      );
    });

    it('sends fixed amount when amount is provided', async () => {
      const provider = createBridgeKycProvider();
      await provider.createTransfer({
        customerId: 'cust_1',
        currency: 'eur',
        paymentRail: 'sepa',
        destinationAddress: '0xtreasury',
        amount: '500.00',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440011',
      });

      const [body] = bridgeCreateTransfer.mock.calls[0] as [
        Record<string, unknown>,
        string,
      ];
      expect(body.amount).toBe('500.00');
      expect(body.developer_fee).toBe('0.0');
      expect(body).not.toHaveProperty('features');
    });

    it('maps response including deposit_message', async () => {
      const provider = createBridgeKycProvider();
      const result = await provider.createTransfer({
        customerId: 'cust_1',
        currency: 'usd',
        paymentRail: 'ach_push',
        destinationAddress: '0xtreasury',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440012',
      });

      expect(result).toEqual({
        providerTransferId: 'transfer_1',
        currency: 'usd',
        paymentRail: 'ach_push',
        amount: null,
        depositMessage: 'BRG7depositmessage',
        depositInstructions: expect.objectContaining({
          deposit_message: 'BRG7depositmessage',
        }),
        destination: {
          currency: 'usdc',
          paymentRail: 'base',
          address: '0xtreasury',
        },
        developerFeePercent: null,
        status: 'awaiting_funds',
      });
    });
  });

  describe('registerExternalAccount', () => {
    beforeEach(() => {
      bridgeCreateExternalAccount.mockResolvedValue({
        id: 'ext_1',
        currency: 'usd',
        active: true,
        bank_name: 'Lead Bank',
        account_owner_name: 'Acme DAO',
        last_4: '9123',
      });
    });

    it('maps USD ACH external account request', async () => {
      const provider = createBridgeKycProvider();
      const result = await provider.registerExternalAccount({
        customerId: 'cust_1',
        railKey: 'usd_ach',
        bankName: 'Lead Bank',
        accountName: 'Operating',
        accountOwnerName: 'Acme DAO',
        accountOwnerType: 'business',
        businessName: 'Acme DAO',
        routingNumber: '101019644',
        accountNumber: '215268129123',
        checkingOrSavings: 'checking',
        address: {
          street_line_1: '923 Folsom Street',
          city: 'San Francisco',
          subdivision: 'CA',
          postal_code: '94107',
          country: 'USA',
        },
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440020',
      });

      expect(bridgeCreateExternalAccount).toHaveBeenCalledWith(
        'cust_1',
        expect.objectContaining({
          currency: 'usd',
          account_type: 'us',
          account: {
            routing_number: '101019644',
            account_number: '215268129123',
            checking_or_savings: 'checking',
          },
        }),
        '550e8400-e29b-41d4-a716-446655440020',
      );
      expect(result.providerExternalAccountId).toBe('ext_1');
      expect(result.accountLast4).toBe('9123');
    });
  });

  describe('createLiquidationAddress', () => {
    beforeEach(() => {
      bridgeCreateLiquidationAddress.mockResolvedValue({
        id: 'la_1',
        chain: 'base',
        currency: 'usdc',
        address: '0xliquidation',
        external_account_id: 'ext_1',
        destination_payment_rail: 'ach',
        destination_currency: 'usd',
        state: 'active',
      });
    });

    it('creates liquidation address linked to external account', async () => {
      const provider = createBridgeKycProvider();
      const result = await provider.createLiquidationAddress({
        customerId: 'cust_1',
        externalAccountId: 'ext_1',
        sourceCurrency: 'usdc',
        destinationPaymentRail: 'ach',
        destinationCurrency: 'usd',
        idempotencyKey: '550e8400-e29b-41d4-a716-446655440021',
      });

      expect(bridgeCreateLiquidationAddress).toHaveBeenCalledWith(
        'cust_1',
        {
          chain: 'base',
          currency: 'usdc',
          external_account_id: 'ext_1',
          destination_payment_rail: 'ach',
          destination_currency: 'usd',
        },
        '550e8400-e29b-41d4-a716-446655440021',
      );
      expect(result.evmAddress).toBe('0xliquidation');
      expect(result.state).toBe('active');
    });
  });
});
