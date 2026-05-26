import { describe, expect, it } from 'vitest';

import {
  isTransientAppNetworkError,
  isTransientMatrixNetworkError,
} from '../client/matrix-network-errors';

describe('isTransientMatrixNetworkError', () => {
  it('detects fetch failed sync errors', () => {
    expect(
      isTransientMatrixNetworkError(new Error('ConnectionError: fetch failed')),
    ).toBe(true);
  });

  it('detects Chrome network suspend codes in message text', () => {
    expect(
      isTransientMatrixNetworkError(
        new Error('Failed to fetch: net::ERR_NETWORK_IO_SUSPENDED'),
      ),
    ).toBe(true);
    expect(
      isTransientMatrixNetworkError(
        new Error('Failed to fetch: net::ERR_NETWORK_CHANGED'),
      ),
    ).toBe(true);
  });

  it('detects nested cause messages', () => {
    expect(
      isTransientMatrixNetworkError(
        new Error('sync failed', { cause: new Error('fetch failed') }),
      ),
    ).toBe(true);
  });

  it('returns false for unknown token auth failures', () => {
    expect(
      isTransientMatrixNetworkError(
        new Error('M_UNKNOWN_TOKEN: Unknown token'),
      ),
    ).toBe(false);
  });

  it('returns false for empty errors', () => {
    expect(isTransientMatrixNetworkError(null)).toBe(false);
    expect(isTransientMatrixNetworkError('')).toBe(false);
  });
});

describe('isTransientAppNetworkError', () => {
  it('delegates to matrix network classifier', () => {
    expect(isTransientAppNetworkError(new Error('network error'))).toBe(true);
  });
});
