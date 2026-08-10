/**
 * A Chainlink feed answer is only as good as its timestamp: `latestRoundData`
 * keeps serving the last round forever, so a stalled feed reports a plausible
 * but frozen price. Anything older than this is treated as no answer at all.
 *
 * Deliberately well above the 24h heartbeat of the fiat feeds. A rejected rate
 * falls back to 1:1, which for AUD is a ~35% error, whereas a day-old rate is
 * off by a fraction of a percent — only a genuinely dead feed should trip this.
 */
export const FEED_MAX_AGE_SECONDS = 48 * 60 * 60;

/** The fields of `latestRoundData` we actually price against. */
export type ChainlinkRound = {
  answer?: bigint;
  updatedAt?: bigint;
};

export type FeedRateResult =
  | { ok: true; rate: number }
  | { ok: false; reason: 'invalid' | 'stale' };

/**
 * The price from one feed round, scaled by the feed's own decimals.
 *
 * `nowSeconds` is injectable so the staleness boundary can be tested.
 */
export function parseFeedRate(
  round: ChainlinkRound,
  decimals: number,
  nowSeconds: number = Math.floor(Date.now() / 1000),
): FeedRateResult {
  const { answer, updatedAt } = round;

  if (answer == null || answer <= 0n) return { ok: false, reason: 'invalid' };
  if (!Number.isInteger(decimals) || decimals < 0 || decimals > 30) {
    return { ok: false, reason: 'invalid' };
  }
  // A zero timestamp means the round never completed.
  if (updatedAt == null || updatedAt <= 0n) {
    return { ok: false, reason: 'invalid' };
  }
  if (nowSeconds - Number(updatedAt) > FEED_MAX_AGE_SECONDS) {
    return { ok: false, reason: 'stale' };
  }

  const rate = Number(answer) / 10 ** decimals;
  if (!Number.isFinite(rate) || rate <= 0) {
    return { ok: false, reason: 'invalid' };
  }
  return { ok: true, rate };
}
