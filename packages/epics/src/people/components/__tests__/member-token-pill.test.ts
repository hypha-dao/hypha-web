import { describe, expect, it } from 'vitest';

import {
  formatMemberTokenAmount,
  selectMemberTokenPill,
} from '../member-token-pill';

const ecredits = {
  address: '0xaaa',
  symbol: 'ECREDITS',
  type: 'credits',
  createdAt: '2024-01-01T00:00:00.000Z',
};

const ownership = {
  address: '0xbbb',
  symbol: 'SCHOOL',
  type: 'ownership',
  createdAt: '2024-02-01T00:00:00.000Z',
};

describe('selectMemberTokenPill', () => {
  it('shows the primary token when the wallet holds it', () => {
    expect(
      selectMemberTokenPill({
        minted: [ecredits, ownership],
        holdings: [{ address: '0xAaA', value: 1284 }],
      }),
    ).toEqual({ symbol: 'ECREDITS', amount: 1284 });
  });

  it('hides the pill when the wallet does not hold the primary token', () => {
    expect(
      selectMemberTokenPill({
        minted: [ecredits, ownership],
        holdings: [{ address: '0xbbb', value: 10 }],
      }),
    ).toBeNull();
  });

  it('hides a zero balance of the primary token', () => {
    expect(
      selectMemberTokenPill({
        minted: [ecredits],
        holdings: [
          { address: '0xaaa', value: 0 },
          { address: '0xbbb', value: 4 },
        ],
      }),
    ).toBeNull();
  });

  it('uses ownership only when the space minted no community token', () => {
    expect(
      selectMemberTokenPill({
        minted: [ownership],
        holdings: [{ address: '0xbbb', value: 2 }],
      }),
    ).toEqual({ symbol: 'SCHOOL', amount: 2 });
  });

  it('skips an archived token and keeps the next community token', () => {
    expect(
      selectMemberTokenPill({
        minted: [
          { ...ecredits, archived: true },
          {
            address: '0xccc',
            symbol: 'utility',
            type: 'utility',
            createdAt: '2024-06-01T00:00:00.000Z',
          },
        ],
        holdings: [{ address: '0xccc', value: 8 }],
      }),
    ).toEqual({ symbol: 'UTILITY', amount: 8 });
  });

  it('keeps the oldest community token when several were minted', () => {
    expect(
      selectMemberTokenPill({
        minted: [
          {
            address: '0xddd',
            symbol: 'NEW',
            type: 'utility',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            address: '0xeee',
            symbol: 'OLD',
            type: 'utility',
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        holdings: [
          { address: '0xddd', value: 9 },
          { address: '0xeee', value: 1 },
        ],
      }),
    ).toEqual({ symbol: 'OLD', amount: 1 });
  });

  it('prefers the oldest primary token across types', () => {
    expect(
      selectMemberTokenPill({
        minted: [
          {
            address: '0xfff',
            symbol: 'NEWCRED',
            type: 'credits',
            createdAt: '2025-01-01T00:00:00.000Z',
          },
          {
            address: '0xeee',
            symbol: 'OLDUTIL',
            type: 'utility',
            createdAt: '2023-01-01T00:00:00.000Z',
          },
        ],
        holdings: [
          { address: '0xfff', value: 9 },
          { address: '0xeee', value: 1 },
        ],
      }),
    ).toEqual({ symbol: 'OLDUTIL', amount: 1 });
  });
});

describe('formatMemberTokenAmount', () => {
  it('groups a whole balance', () => {
    expect(formatMemberTokenAmount(1284, 'en')).toBe('1,284');
  });

  it('keeps dust holdings readable', () => {
    expect(formatMemberTokenAmount(0.004, 'en')).toBe('0.004');
  });

  it('returns nothing for an empty balance', () => {
    expect(formatMemberTokenAmount(0, 'en')).toBe('');
  });
});
