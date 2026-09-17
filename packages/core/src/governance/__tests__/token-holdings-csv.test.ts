import { describe, expect, it } from 'vitest';

import {
  buildTokenHoldingsCsv,
  escapeCsvField,
  tokenHoldingsCsvFilename,
  TOKEN_HOLDINGS_CSV_COLUMNS,
} from '../token-holdings-csv';

describe('escapeCsvField', () => {
  it('leaves simple values unquoted', () => {
    expect(escapeCsvField('Alice')).toBe('Alice');
    expect(escapeCsvField('12.5')).toBe('12.5');
  });

  it('quotes commas, quotes, and newlines', () => {
    expect(escapeCsvField('Doe, Jane')).toBe('"Doe, Jane"');
    expect(escapeCsvField('He said "hi"')).toBe('"He said ""hi"""');
    expect(escapeCsvField('line\nbreak')).toBe('"line\nbreak"');
  });
});

describe('buildTokenHoldingsCsv', () => {
  it('emits a header row when there are no holdings', () => {
    const csv = buildTokenHoldingsCsv([
      {
        name: 'Voice',
        symbol: 'VOICE',
        token_address: '0xabc',
        holdings: [],
      },
    ]);
    expect(csv).toBe(`${TOKEN_HOLDINGS_CSV_COLUMNS.join(',')}\n`);
  });

  it('includes every holder row, not a truncated chart slice', () => {
    const holdings = Array.from({ length: 12 }, (_, index) => ({
      holder_kind: 'person',
      address: `0x${String(index).padStart(40, '0')}`,
      display_name: `Holder ${index + 1}`,
      slug: `holder-${index + 1}`,
      balance: String(100 - index),
      balance_raw: String((100 - index) * 1_000_000),
      share_pct: 100 - index,
    }));

    const csv = buildTokenHoldingsCsv([
      {
        name: 'Hypha Token',
        symbol: 'HYPHA',
        token_address: '0x8b93862835c36e9689e9bb1ab21de3982e266cd3',
        holdings,
      },
    ]);

    const lines = csv.trimEnd().split('\n');
    expect(lines).toHaveLength(13);
    expect(lines[0]).toBe(TOKEN_HOLDINGS_CSV_COLUMNS.join(','));
    expect(lines[1]).toContain('Holder 1');
    expect(lines[12]).toContain('Holder 12');
    expect(csv).toContain('person');
    expect(csv).toContain('holder-12');
  });

  it('writes one row per holder across tokens and escapes names', () => {
    const csv = buildTokenHoldingsCsv([
      {
        name: 'Utility, Token',
        symbol: 'UTIL',
        token_address: '0x111',
        holdings: [
          {
            holder_kind: 'treasury',
            address: '0xaaa',
            display_name: 'Treasury',
            slug: null,
            balance: '10',
            balance_raw: '10000000000000000000',
            share_pct: 50,
          },
        ],
      },
      {
        name: 'Voice',
        symbol: 'VOICE',
        token_address: '0x222',
        holdings: [
          {
            holder_kind: 'person',
            address: null,
            display_name: 'Alex "Prate"',
            slug: 'alex',
            balance: '5',
            balance_raw: '5000000000000000000',
            share_pct: 25.5,
          },
        ],
      },
    ]);

    const lines = csv.trimEnd().split('\n');
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain('"Utility, Token"');
    expect(lines[1]).toContain('treasury');
    expect(lines[2]).toContain('"Alex ""Prate"""');
    expect(lines[2]).toContain(',alex,');
    expect(lines[2]).toContain('25.5');
  });
});

describe('tokenHoldingsCsvFilename', () => {
  it('uses the space slug and ISO date', () => {
    expect(
      tokenHoldingsCsvFilename('hypha', new Date('2026-09-17T12:00:00.000Z')),
    ).toBe('hypha-token-holders-2026-09-17.csv');
  });

  it('sanitizes unsafe slug characters', () => {
    expect(
      tokenHoldingsCsvFilename(
        '../weird slug!',
        new Date('2026-09-17T12:00:00.000Z'),
      ),
    ).toBe('weird-slug-token-holders-2026-09-17.csv');
  });

  it('handles hyphen-heavy input without regex backtracking', () => {
    expect(
      tokenHoldingsCsvFilename(
        `${'-'.repeat(200)}hypha${'-'.repeat(200)}`,
        new Date('2026-09-17T12:00:00.000Z'),
      ),
    ).toBe('hypha-token-holders-2026-09-17.csv');
  });
});
