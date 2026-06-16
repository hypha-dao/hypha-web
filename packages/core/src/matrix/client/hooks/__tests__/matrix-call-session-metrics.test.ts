import { describe, expect, it, beforeEach } from 'vitest';
import {
  MATRIX_CALL_PROACTIVE_REFRESH_BUFFER_MS,
  MATRIX_CALL_PROACTIVE_REFRESH_FALLBACK_MS,
  getMatrixCallSessionMetrics,
  recordMatrixCallTokenRefreshFailure,
  recordMatrixCallTokenRefreshSuccess,
  resetMatrixCallSessionMetricsForTests,
  resolveMatrixCallProactiveRefreshIntervalMs,
} from '../matrix-call-session-metrics';

describe('resolveMatrixCallProactiveRefreshIntervalMs', () => {
  it('uses TTL minus buffer when expires_in is available', () => {
    const expiresInSec = 3600;
    expect(resolveMatrixCallProactiveRefreshIntervalMs(expiresInSec)).toBe(
      expiresInSec * 1000 - MATRIX_CALL_PROACTIVE_REFRESH_BUFFER_MS,
    );
  });

  it('falls back to 25 minutes when expires_in is missing', () => {
    expect(resolveMatrixCallProactiveRefreshIntervalMs(undefined)).toBe(
      MATRIX_CALL_PROACTIVE_REFRESH_FALLBACK_MS,
    );
  });

  it('never schedules below one minute', () => {
    expect(resolveMatrixCallProactiveRefreshIntervalMs(30)).toBe(60_000);
  });
});

describe('matrix call session metrics', () => {
  beforeEach(() => {
    resetMatrixCallSessionMetricsForTests();
  });

  it('tracks successful proactive refresh count', () => {
    recordMatrixCallTokenRefreshSuccess();
    recordMatrixCallTokenRefreshSuccess();
    expect(getMatrixCallSessionMetrics()).toEqual({
      tokenRefreshCount: 2,
      lastMatrixError: null,
    });
  });

  it('records last refresh failure message', () => {
    recordMatrixCallTokenRefreshFailure(new Error('token expired'));
    expect(getMatrixCallSessionMetrics().lastMatrixError).toBe('token expired');
  });
});
