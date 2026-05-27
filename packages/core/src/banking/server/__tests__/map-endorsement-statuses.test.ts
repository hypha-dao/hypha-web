import { describe, expect, it } from 'vitest';

import type { BankRailPublicStatus } from '../../types';
import { mapEndorsementStatuses } from '../map-endorsement-statuses';

function rail(
  partial: Partial<BankRailPublicStatus> &
    Pick<BankRailPublicStatus, 'railKey'>,
): BankRailPublicStatus {
  return {
    currency: 'usd',
    paymentRail: 'ach',
    endorsement: 'base',
    endorsementStatus: null,
    operationalStatus: 'not_requested',
    hasVirtualAccount: false,
    validation: {
      key: 'base',
      status: null,
      isComplete: false,
    },
    ...partial,
  };
}

describe('mapEndorsementStatuses', () => {
  it('groups transfer corridors under the same endorsement', () => {
    const statuses = mapEndorsementStatuses([
      rail({
        railKey: 'usd',
        currency: 'usd',
        paymentRail: 'ach',
        endorsement: 'base',
        operationalStatus: 'approved',
      }),
      rail({
        railKey: 'usd-ach',
        currency: 'usd',
        paymentRail: 'ach_push',
        endorsement: 'base',
        operationalStatus: 'approved',
      }),
      rail({
        railKey: 'usd-wire',
        currency: 'usd',
        paymentRail: 'wire',
        endorsement: 'base',
        operationalStatus: 'not_requested',
      }),
      rail({
        railKey: 'eur',
        currency: 'eur',
        paymentRail: 'sepa',
        endorsement: 'sepa',
        operationalStatus: 'pending',
      }),
    ]);

    expect(statuses).toHaveLength(2);
    expect(statuses.map((entry) => entry.endorsement)).toEqual([
      'base',
      'sepa',
    ]);
    expect(statuses[0]?.operationalStatus).toBe('approved');
    expect(statuses[1]?.operationalStatus).toBe('pending');
  });
});
