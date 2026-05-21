import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { bridgeCreateKycLink } from '../bridge-client';

const fetchMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

describe('bridgeCreateKycLink', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock.mockReset();
    process.env.BRIDGE_API_KEY = 'test-key';
    process.env.BRIDGE_API_BASE_URL = 'https://api.sandbox.bridge.xyz';
  });

  it('returns existing_kyc_link from 400 as a successful response', async () => {
    const existing = {
      id: 'kyc_existing_1',
      customer_id: 'cust_existing',
      kyc_link: 'https://bridge.example/kyc/existing',
      tos_link: 'https://bridge.example/tos/existing',
      kyc_status: 'under_review',
      tos_status: 'approved',
      created_at: '2026-05-18T00:00:00Z',
    };

    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () =>
        JSON.stringify({
          code: 'duplicate',
          existing_kyc_link: existing,
        }),
    });

    const result = await bridgeCreateKycLink(
      {
        full_name: 'Acme Foundation Ltd.',
        email: 'compliance@acme.org',
        type: 'business',
      },
      '550e8400-e29b-41d4-a716-446655440000',
    );

    expect(result).toEqual(existing);
  });

  it('still throws on 400 without existing_kyc_link', async () => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      text: async () => JSON.stringify({ message: 'Invalid email' }),
    });

    await expect(
      bridgeCreateKycLink(
        {
          full_name: 'Acme',
          email: 'bad@example.com',
          type: 'business',
        },
        '550e8400-e29b-41d4-a716-446655440000',
      ),
    ).rejects.toThrow(/Bridge API error \(400\)/);
  });
});
