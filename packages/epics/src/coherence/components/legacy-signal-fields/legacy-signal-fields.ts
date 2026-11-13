import {
  COHERENCE_PRIORITIES,
  type CoherencePriority,
} from '@hypha-platform/ui-utils';
import {
  parseCapitalKeys,
  type CapitalKey,
} from '../../../../../core/src/network/capitals';

/**
 * TODO: Temporary for Reciprocal Exchange. Delete this folder, and the
 * insertion points in `create-signal-form.tsx` and `signal-page.tsx`, when
 * Reciprocal Exchange no longer reads these columns.
 *
 * Priority `medium` is the value stored for every signal that never opened
 * these fields, so it does not count as filled.
 */
export type LegacySignalFieldSource = {
  sharedWithNetwork?: boolean | null;
  capitals?: unknown;
  priority?: string | null;
  tags?: readonly string[] | null;
  dueAt?: Date | string | null;
  indicativePayouts?: unknown;
};

export type LegacyIndicativePayout = {
  amount: string;
  token: string;
};

export type LegacySignalFieldsShown = {
  sharedWithNetwork: boolean;
  capitals: CapitalKey[];
  priority: CoherencePriority | null;
  tags: string[];
  dueAt: Date | null;
  indicativePayouts: LegacyIndicativePayout[];
};

function filledTags(tags: readonly string[] | null | undefined): string[] {
  if (!tags) return [];
  return tags
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter((tag) => tag.length > 0);
}

function filledDue(value: Date | string | null | undefined): Date | null {
  if (value == null || value === '') return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function filledPayouts(value: unknown): LegacyIndicativePayout[] {
  if (!Array.isArray(value)) return [];
  const rows: LegacyIndicativePayout[] = [];
  for (const row of value) {
    if (!row || typeof row !== 'object') continue;
    const amount = String((row as { amount?: unknown }).amount ?? '').trim();
    const token = String((row as { token?: unknown }).token ?? '').trim();
    if (!amount || !token) continue;
    rows.push({ amount, token });
  }
  return rows;
}

function filledPriority(
  value: string | null | undefined,
): CoherencePriority | null {
  const priority = value?.trim() ?? '';
  if (
    priority === 'medium' ||
    !(COHERENCE_PRIORITIES as readonly string[]).includes(priority)
  ) {
    return null;
  }
  return priority as CoherencePriority;
}

/** Null when every legacy field is still at its empty default. */
export function legacySignalFieldsToShow(
  source: LegacySignalFieldSource,
): LegacySignalFieldsShown | null {
  const shown: LegacySignalFieldsShown = {
    sharedWithNetwork: source.sharedWithNetwork === true,
    capitals: parseCapitalKeys(source.capitals),
    priority: filledPriority(source.priority),
    tags: filledTags(source.tags),
    dueAt: filledDue(source.dueAt),
    indicativePayouts: filledPayouts(source.indicativePayouts),
  };
  const filled =
    shown.sharedWithNetwork ||
    shown.capitals.length > 0 ||
    shown.priority != null ||
    shown.tags.length > 0 ||
    shown.dueAt != null ||
    shown.indicativePayouts.length > 0;
  return filled ? shown : null;
}
