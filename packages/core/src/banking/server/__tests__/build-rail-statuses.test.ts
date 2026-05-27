import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  buildRailStatuses,
  vaPairKey,
  type BankingProviderState,
} from '../providers/bridge/banking-provider-state';

const kycLink = {
  id: 'kyc_1',
  customer_id: 'cust_1',
  kyc_link: 'https://example.com/kyc',
  kyc_status: 'approved',
  tos_status: 'approved',
} as never;

function makeState(
  endorsements: { name: string; status: string }[],
  pairs: string[] = [],
): BankingProviderState {
  return {
    kycLink,
    customer: { endorsements } as never,
    virtualAccountKeys: new Set(),
    virtualAccountPairs: new Set(pairs),
  };
}

function makeCustomer(requestedRails: string[]) {
  return { id: 1, requestedRails } as never;
}

function railStatus(
  rails: ReturnType<typeof buildRailStatuses>,
  currency: string,
) {
  return rails.find((r) => r.railKey === currency)?.operationalStatus;
}

describe('buildRailStatuses — requested + Bridge-approved gating', () => {
  it('gates on both DB request and Bridge endorsement state', () => {
    const rails = buildRailStatuses({
      customer: makeCustomer(['usd', 'eur']),
      state: makeState([
        { name: 'base', status: 'approved' }, // usd endorsement
        { name: 'sepa', status: 'under_review' }, // eur endorsement
      ]),
    });

    expect(railStatus(rails, 'usd')).toBe('approved'); // requested + approved
    expect(railStatus(rails, 'eur')).toBe('pending'); // requested, not yet approved
    expect(railStatus(rails, 'gbp')).toBe('not_requested'); // not requested
  });

  it('treats empty requestedRails as nothing requested (strict), even if Bridge approved', () => {
    const rails = buildRailStatuses({
      customer: makeCustomer([]),
      state: makeState([{ name: 'base', status: 'approved' }]),
    });

    expect(railStatus(rails, 'usd')).toBe('not_requested');
  });

  it('applies the requested gate to transfer corridors too', () => {
    const rails = buildRailStatuses({
      customer: makeCustomer([]),
      state: makeState([{ name: 'base', status: 'approved' }]),
    });

    // usd-ach / usd-wire corridors must not be usable when usd is not requested.
    const usdAch = rails.find((r) => r.railKey === 'usd-ach');
    expect(usdAch?.operationalStatus).toBe('not_requested');
  });
});

describe('vaPairKey', () => {
  it('lowercases and joins currency + destination', () => {
    expect(vaPairKey('EUR', 'EURC')).toBe('eur:eurc');
  });
});
