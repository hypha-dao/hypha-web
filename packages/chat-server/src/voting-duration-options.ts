/** Duration options (seconds) — keep in sync with epics voting-duration-resubmit.ts / plugin select. */
export const VOTING_DURATION_OPTION_SECONDS = [
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
] as const;

const VOTING_DURATION_OPTION_SET = new Set<number>(
  VOTING_DURATION_OPTION_SECONDS,
);

/** Map raw seconds to the nearest allowed dropdown value for the Agreements form. */
export function normalizeVotingDurationSeconds(
  raw: number | undefined,
): number | undefined {
  if (raw === undefined || !Number.isFinite(raw) || raw < 0) return undefined;
  if (VOTING_DURATION_OPTION_SET.has(raw)) return raw;
  let best = VOTING_DURATION_OPTION_SECONDS[0];
  let bestDist = Math.abs(best - raw);
  for (const opt of VOTING_DURATION_OPTION_SECONDS) {
    const dist = Math.abs(opt - raw);
    if (dist < bestDist) {
      best = opt;
      bestDist = dist;
    }
  }
  return best;
}

export const VOTING_DURATION_CHAT_LABELS: Record<number, string> = {
  [6 * 3600]: '6 hours',
  [12 * 3600]: '12 hours',
  [24 * 3600]: '1 day',
  [2 * 86400]: '2 days',
  [3 * 86400]: '3 days',
  [5 * 86400]: '5 days',
  [7 * 86400]: '7 days',
  [10 * 86400]: '10 days',
  [14 * 86400]: '14 days',
  [21 * 86400]: '21 days',
  [30 * 86400]: '30 days',
};

export function votingDurationLabelForChat(seconds: number): string {
  const normalized = normalizeVotingDurationSeconds(seconds);
  if (normalized === undefined) return 'the minimum voting period on the form';
  return VOTING_DURATION_CHAT_LABELS[normalized] ?? 'the minimum voting period';
}
