/**
 * Client polling tiers (SWR `refreshInterval`, in milliseconds).
 *
 * Every poll of an API route or Server Action is a billed function run, so
 * intervals are grouped by how long the user can tolerate stale data rather
 * than chosen per hook. A user who acts (vote, join, transfer) gets an
 * immediate `mutate`; the poll only picks up other people's changes.
 *
 * - `LIVE`: someone is actively waiting on the result (an open vote).
 * - `ACTIVE`: a screen where changes by others matter within seconds
 *   (proposal page, voter list).
 * - `BACKGROUND`: lists and dashboards where a minute of lag is fine.
 * - `SLOW`: labels and context that rarely change.
 */
export const POLL = {
  LIVE: 5_000,
  ACTIVE: 30_000,
  BACKGROUND: 60_000,
  SLOW: 5 * 60_000,
} as const;

export type PollTier = keyof typeof POLL;
