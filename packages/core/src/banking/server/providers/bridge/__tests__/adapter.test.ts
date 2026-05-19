import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createBridgeKycProvider } from '../adapter';

const bridgeCreateKycLink = vi.fn();

vi.mock('../../../../../common/server/bridge-client', () => ({
  bridgeCreateKycLink: (...args: unknown[]) => bridgeCreateKycLink(...args),
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

  it('omits endorsements from Bridge request when not provided', async () => {
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
    expect(body).not.toHaveProperty('endorsements');
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
});
