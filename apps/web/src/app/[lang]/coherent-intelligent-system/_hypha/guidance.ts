import type { NextAction } from '@hypha-platform/epics';

/**
 * #2486 D5 — the guidance beat. One "dumb" health nudge derived from the
 * space's signals, surfaced as an `emphasis: 'guidance'` chip on the
 * next-actions strip. Clicking it drives the canvas to a filtered `signals`
 * widget (via its `prompt`). This is the only Coherence-Loop-flavoured
 * behaviour in v0 — the real feedback capability is #2478's (spec §7.1).
 */

/** Minimal shape we read off `useFindCoherences().coherences` — kept loose. */
export interface GuidanceSignal {
  priority?: string | null;
  type?: string | null;
  updatedAt?: string | Date | null;
}

export interface GuidanceInput {
  spaceSlug?: string;
  signals?: readonly GuidanceSignal[];
}

const STALE_DAYS = 14;
const CLUSTER_MIN = 3;

function ageInDays(value: GuidanceSignal['updatedAt']): number | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  const ms = date.getTime();
  if (Number.isNaN(ms)) return null;
  return (Date.now() - ms) / (1000 * 60 * 60 * 24);
}

function isUrgent(signal: GuidanceSignal): boolean {
  const p = signal.priority?.toLowerCase();
  return p === 'critical' || p === 'high';
}

/**
 * Returns one guidance `NextAction`, or `null` when there is nothing worth
 * nudging about. Deliberately heuristic — a demo beat, not analytics.
 */
export function computeGuidanceAction(input: GuidanceInput): NextAction | null {
  const spaceSlug = input.spaceSlug?.trim();
  if (!spaceSlug) return null;

  const signals = (input.signals ?? []).filter(Boolean);
  if (signals.length === 0) return null;

  // 1 — a pile-up of high/critical signals gone quiet.
  const staleUrgent = signals.filter((s) => {
    if (!isUrgent(s)) return false;
    const age = ageInDays(s.updatedAt);
    return age == null || age >= STALE_DAYS;
  });
  if (staleUrgent.length >= CLUSTER_MIN) {
    return {
      id: 'guidance-stale-urgent',
      label: `${staleUrgent.length} high-priority signals have been quiet for 2+ weeks — review them`,
      prompt: 'Show the high-priority signals that need attention',
      emphasis: 'guidance',
    };
  }

  // 2 — one type dominates the board.
  const byType = new Map<string, number>();
  for (const s of signals) {
    const type = s.type?.trim();
    if (!type) continue;
    byType.set(type, (byType.get(type) ?? 0) + 1);
  }
  let topType: string | undefined;
  let topCount = 0;
  for (const [type, count] of byType) {
    if (count > topCount) {
      topType = type;
      topCount = count;
    }
  }
  if (topType && topCount >= CLUSTER_MIN) {
    return {
      id: 'guidance-type-cluster',
      label: `${topCount} “${topType}” signals — review the cluster`,
      prompt: `Show the ${topType} signals so I can review them`,
      emphasis: 'guidance',
    };
  }

  // 3 — nothing sharp, but signals exist: offer the weekly review.
  return {
    id: 'guidance-weekly-review',
    label: 'Weekly coherence review',
    prompt: 'Walk me through this space’s signals for a weekly review',
    emphasis: 'guidance',
  };
}
