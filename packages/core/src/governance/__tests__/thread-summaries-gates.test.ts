import { describe, expect, it } from 'vitest';
import {
  shouldRefreshThreadSummary,
  THREAD_SUMMARY_REFRESH_INTERVAL_MS,
} from '../server/thread-summaries-gates';

describe('shouldRefreshThreadSummary', () => {
  const now = 1_700_000_000_000;

  it('requires new message activity', () => {
    expect(
      shouldRefreshThreadSummary({
        lastMessageOriginServerTs: null,
        lastSummarizedOriginServerTs: null,
        lastRefreshedAt: null,
        nowMs: now,
      }),
    ).toEqual({ ok: false, reason: 'no_thread_activity' });
  });

  it('skips when already summarized through latest message', () => {
    expect(
      shouldRefreshThreadSummary({
        lastMessageOriginServerTs: 1000,
        lastSummarizedOriginServerTs: 1000,
        lastRefreshedAt: null,
        nowMs: now,
      }),
    ).toEqual({ ok: false, reason: 'no_new_messages' });
  });

  it('rate limits refreshes to 30 minutes', () => {
    expect(
      shouldRefreshThreadSummary({
        lastMessageOriginServerTs: 2000,
        lastSummarizedOriginServerTs: 1000,
        lastRefreshedAt: new Date(
          now - THREAD_SUMMARY_REFRESH_INTERVAL_MS + 60_000,
        ).toISOString(),
        nowMs: now,
      }),
    ).toEqual({ ok: false, reason: 'rate_limited' });
  });

  it('allows refresh when activity is new and interval elapsed', () => {
    expect(
      shouldRefreshThreadSummary({
        lastMessageOriginServerTs: 2000,
        lastSummarizedOriginServerTs: 1000,
        lastRefreshedAt: new Date(
          now - THREAD_SUMMARY_REFRESH_INTERVAL_MS - 1,
        ).toISOString(),
        nowMs: now,
      }),
    ).toEqual({ ok: true });
  });

  it('supports force refresh', () => {
    expect(
      shouldRefreshThreadSummary({
        lastMessageOriginServerTs: 1000,
        lastSummarizedOriginServerTs: 1000,
        lastRefreshedAt: new Date(now - 1000).toISOString(),
        nowMs: now,
        force: true,
      }),
    ).toEqual({ ok: true });
  });
});
