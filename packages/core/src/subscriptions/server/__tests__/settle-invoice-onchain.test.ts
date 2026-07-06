import { afterEach, describe, expect, it } from 'vitest';
import { vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { settleSpaceSubscriptionOnchain } from '../settle-invoice-onchain';

describe('settleSpaceSubscriptionOnchain', () => {
  const originalKey = process.env.SUBSCRIPTION_PAYER_PRIVATE_KEY;

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.SUBSCRIPTION_PAYER_PRIVATE_KEY;
    } else {
      process.env.SUBSCRIPTION_PAYER_PRIVATE_KEY = originalKey;
    }
  });

  it('fails gracefully when the payer key is not configured', async () => {
    delete process.env.SUBSCRIPTION_PAYER_PRIVATE_KEY;

    const result = await settleSpaceSubscriptionOnchain({
      web3SpaceId: 1,
      amountUsdc: 11_010_000n,
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('SUBSCRIPTION_PAYER_PRIVATE_KEY');
    }
  });

  it('fails gracefully when the payer key is malformed', async () => {
    process.env.SUBSCRIPTION_PAYER_PRIVATE_KEY = 'not-a-key';

    const result = await settleSpaceSubscriptionOnchain({
      web3SpaceId: 1,
      amountUsdc: 11_010_000n,
    });

    expect(result.ok).toBe(false);
  });
});
