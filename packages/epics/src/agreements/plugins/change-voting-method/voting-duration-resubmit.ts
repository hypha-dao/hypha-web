/** Duration options (seconds) — must stay in sync with `plugin.tsx` select options. */
export const VOTING_DURATION_OPTION_VALUES = new Set([
  6 * 3600,
  12 * 3600,
  24 * 3600,
  2 * 86400,
  3 * 86400,
  5 * 86400,
  7 * 86400,
  10 * 86400,
  14 * 86400,
  21 * 86400,
  30 * 86400,
]);

const VOTING_DURATION_OPTIONS = [...VOTING_DURATION_OPTION_VALUES].sort(
  (a, b) => a - b,
);

/** Map on-chain duration to the nearest allowed select value so the dropdown can display it. */
export function normalizeVotingDurationForResubmitSelect(
  raw: bigint | number | undefined,
): number | undefined {
  if (raw === undefined) return undefined;
  const seconds = typeof raw === 'bigint' ? Number(raw) : raw;
  if (!Number.isFinite(seconds) || seconds < 0) return undefined;
  if (VOTING_DURATION_OPTION_VALUES.has(seconds)) return seconds;
  let best = VOTING_DURATION_OPTIONS[0] ?? 0;
  let bestDist = Math.abs(best - seconds);
  for (const opt of VOTING_DURATION_OPTIONS) {
    const d = Math.abs(opt - seconds);
    if (d < bestDist) {
      best = opt;
      bestDist = d;
    }
  }
  return best;
}
