import type { QuestUpdateChange } from '@hypha-platform/core/client';
import { questRichTextPlain } from './quest-rich-text';

export type QuestUpdateDetailEntry =
  | { kind: 'text'; label: string; before: string; after: string }
  | { kind: 'short'; label: string; line: string };

const TEXT_FIELDS = new Set([
  'goal',
  'scope',
  'successCriteria',
  'description',
]);

const FIELD_LABELS: Record<string, string> = {
  goal: 'Goal',
  scope: 'Scope',
  successCriteria: 'Success',
  description: 'Description',
  name: 'Title',
  status: 'Status',
  targetDate: 'Target date',
  lead: 'Lead',
  rewards: 'Reward',
};

function shownText(value: string | null | undefined): string {
  return questRichTextPlain(value ?? '').trim() || 'none';
}

function shownShort(value: string | null | undefined): string {
  return (value ?? '').trim() || 'none';
}

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function textEntry(
  label: string,
  before: string | null | undefined,
  after: string | null | undefined,
): QuestUpdateDetailEntry | null {
  const beforeRaw = (before ?? '').trim();
  const afterRaw = (after ?? '').trim();
  if (beforeRaw === afterRaw) return null;
  const beforeText = shownText(before);
  const afterText = shownText(after);
  return {
    kind: 'text',
    label,
    before: beforeText === afterText ? beforeRaw || 'none' : beforeText,
    after: beforeText === afterText ? afterRaw || 'none' : afterText,
  };
}

function shortLine(
  label: string,
  action: string | undefined,
  beforeText: string,
  afterText: string,
): string {
  if (action === 'reordered') {
    return `Reordered from ${beforeText} to ${afterText}`;
  }
  if (action === 'added') return `Added ${label}: ${afterText}`;
  if (action === 'removed') return `Removed ${label}: ${beforeText}`;
  return `${label}: from ${beforeText} to ${afterText}`;
}

function shortEntry(
  label: string,
  before: string | null | undefined,
  after: string | null | undefined,
  action?: string,
): QuestUpdateDetailEntry | null {
  const beforeText = shownShort(before);
  const afterText = shownShort(after);
  if (action !== 'reordered' && action !== 'added' && action !== 'removed') {
    if (beforeText === afterText) return null;
  }
  if (action === 'added' && afterText === 'none') return null;
  if (action === 'removed' && beforeText === 'none') return null;
  if (action === 'reordered' && beforeText === afterText) return null;
  return {
    kind: 'short',
    label,
    line: shortLine(label, action, beforeText, afterText),
  };
}

export function questUpdateDetailEntries(
  change: QuestUpdateChange | null | undefined,
): QuestUpdateDetailEntry[] {
  if (!change) return [];
  if (change.items && change.items.length > 0) {
    const entries = change.items.flatMap((item) => {
      const entry =
        item.format === 'text'
          ? textEntry(item.label, item.before, item.after)
          : shortEntry(item.label, item.before, item.after, item.action);
      return entry ? [entry] : [];
    });
    if (entries.length > 0) return entries;
  }
  if (change.before == null && change.after == null) return [];
  const text =
    change.format === 'text' ||
    (change.format == null && TEXT_FIELDS.has(change.field));
  const entry = text
    ? textEntry(fieldLabel(change.field), change.before, change.after)
    : shortEntry(
        fieldLabel(change.field),
        change.before,
        change.after,
        change.action,
      );
  return entry ? [entry] : [];
}

export function questUpdateDetailIsLong(
  entries: readonly QuestUpdateDetailEntry[],
): boolean {
  const text = entries
    .map((entry) =>
      entry.kind === 'short'
        ? entry.line
        : `${entry.label}\n${entry.before}\n${entry.after}`,
    )
    .join('\n');
  return text.length > 240 || text.split('\n').length > 8;
}
