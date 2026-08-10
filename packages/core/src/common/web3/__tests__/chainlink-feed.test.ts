import { describe, expect, it } from 'vitest';
import {
  FEED_MAX_AGE_SECONDS,
  FEED_MAX_FUTURE_SKEW_SECONDS,
  parseFeedRate,
} from '../chainlink-feed';

const NOW = 1_800_000_000;
const fresh = (answer: bigint) => ({ answer, updatedAt: BigInt(NOW - 60) });

describe('parseFeedRate', () => {
  it('scales the answer by the feed decimals', () => {
    // AUD/USD reports 8 decimals on Base.
    expect(parseFeedRate(fresh(65_000_000n), 8, NOW)).toEqual({
      ok: true,
      rate: 0.65,
    });
  });

  it('rejects an answer from a stalled feed', () => {
    const round = {
      answer: 65_000_000n,
      updatedAt: BigInt(NOW - FEED_MAX_AGE_SECONDS - 1),
    };
    expect(parseFeedRate(round, 8, NOW)).toEqual({
      ok: false,
      reason: 'stale',
    });
  });

  it('accepts an answer right at the staleness boundary', () => {
    const round = {
      answer: 65_000_000n,
      updatedAt: BigInt(NOW - FEED_MAX_AGE_SECONDS),
    };
    expect(parseFeedRate(round, 8, NOW)).toEqual({ ok: true, rate: 0.65 });
  });

  it('tolerates a feed timestamp slightly ahead of local time', () => {
    const round = { answer: 65_000_000n, updatedAt: BigInt(NOW + 30) };
    expect(parseFeedRate(round, 8, NOW)).toEqual({ ok: true, rate: 0.65 });
  });

  it('accepts an answer right at the future skew boundary', () => {
    const round = {
      answer: 65_000_000n,
      updatedAt: BigInt(NOW + FEED_MAX_FUTURE_SKEW_SECONDS),
    };
    expect(parseFeedRate(round, 8, NOW)).toEqual({ ok: true, rate: 0.65 });
  });

  it('rejects a timestamp beyond the allowed future skew', () => {
    const round = {
      answer: 65_000_000n,
      updatedAt: BigInt(NOW + FEED_MAX_FUTURE_SKEW_SECONDS + 1),
    };
    expect(parseFeedRate(round, 8, NOW)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects a non-positive answer', () => {
    expect(parseFeedRate(fresh(0n), 8, NOW)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(parseFeedRate(fresh(-1n), 8, NOW)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });

  it('rejects a missing answer or an incomplete round', () => {
    expect(parseFeedRate({}, 8, NOW)).toEqual({ ok: false, reason: 'invalid' });
    expect(parseFeedRate({ answer: 65_000_000n }, 8, NOW)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(
      parseFeedRate({ answer: 65_000_000n, updatedAt: 0n }, 8, NOW),
    ).toEqual({ ok: false, reason: 'invalid' });
  });

  it('rejects nonsensical decimals rather than returning NaN', () => {
    expect(parseFeedRate(fresh(65_000_000n), Number.NaN, NOW)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(parseFeedRate(fresh(65_000_000n), -1, NOW)).toEqual({
      ok: false,
      reason: 'invalid',
    });
    expect(parseFeedRate(fresh(65_000_000n), 999, NOW)).toEqual({
      ok: false,
      reason: 'invalid',
    });
  });
});
