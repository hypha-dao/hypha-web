import { describe, expect, it } from 'vitest';

import {
  isMissingNetworkVisibleColumn,
  omitNetworkVisible,
  withOptionalNetworkVisibleColumn,
} from '../optional-network-visible';

describe('isMissingNetworkVisibleColumn', () => {
  it('detects a Postgres undefined-column error', () => {
    const error = Object.assign(
      new Error('column "network_visible" does not exist'),
      {
        code: '42703',
      },
    );
    expect(isMissingNetworkVisibleColumn(error)).toBe(true);
  });

  it('detects a wrapped drizzle error via cause', () => {
    const cause = Object.assign(
      new Error('column "network_visible" does not exist'),
      {
        code: '42703',
      },
    );
    expect(
      isMissingNetworkVisibleColumn(
        new Error('Failed query: select "network_visible"', { cause }),
      ),
    ).toBe(true);
  });

  it('ignores unrelated query failures', () => {
    expect(isMissingNetworkVisibleColumn(new Error('connection refused'))).toBe(
      false,
    );
    expect(
      isMissingNetworkVisibleColumn(
        new Error('column "preferred_currency" does not exist'),
      ),
    ).toBe(false);
  });
});

describe('withOptionalNetworkVisibleColumn', () => {
  it('returns the first result when the column exists', async () => {
    const result = await withOptionalNetworkVisibleColumn(
      async () => 'with-column',
      async () => 'without-column',
    );
    expect(result).toBe('with-column');
  });

  it('falls back when the column is missing', async () => {
    const result = await withOptionalNetworkVisibleColumn(
      async () => {
        throw Object.assign(
          new Error('column "network_visible" does not exist'),
          { code: '42703' },
        );
      },
      async () => 'without-column',
    );
    expect(result).toBe('without-column');
  });

  it('rethrows unrelated errors', async () => {
    await expect(
      withOptionalNetworkVisibleColumn(
        async () => {
          throw new Error('rls failed');
        },
        async () => 'without-column',
      ),
    ).rejects.toThrow('rls failed');
  });
});

describe('omitNetworkVisible', () => {
  it('strips networkVisible so inserts can proceed pre-migration', () => {
    expect(
      omitNetworkVisible({ slug: 'ada', networkVisible: true, name: 'Ada' }),
    ).toEqual({ slug: 'ada', name: 'Ada' });
  });
});
