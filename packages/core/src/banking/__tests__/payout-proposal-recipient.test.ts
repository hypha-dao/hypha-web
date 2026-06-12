import { describe, expect, it } from 'vitest';

import { schemaCreateAgreementForm } from '../../governance/validation';

/** Example Bridge liquidation address shape (Base USDC off-ramp target). */
const LIQUIDATION_ADDRESS = '0x4d0280da2f2fDA5103914bCc5aad114743152A9c';

describe('payout proposal recipient (#2289 B.3)', () => {
  it('accepts a Bridge liquidation EVM address in DeployFunds / Expenses form schema', () => {
    const result = schemaCreateAgreementForm.safeParse({
      title: 'Treasury payout to external bank',
      description:
        'Transfer USDC to registered liquidation address for fiat wire.',
      spaceId: 1,
      creatorId: 1,
      recipient: LIQUIDATION_ADDRESS,
      payouts: [
        { amount: '100', token: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
      ],
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.recipient).toBe(LIQUIDATION_ADDRESS);
    }
  });
});
