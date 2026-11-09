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
  const beforeText = shownText(before);
  const afterText = shownText(after);
  if (beforeText === afterText) return null;
  return { kind: 'text', label, before: beforeText, after: afterText };
}

function shortEntry(
  label: string,
  before: string | null | undefined,
  after: string | null | undefined,
): QuestUpdateDetailEntry | null {
  const beforeText = shownShort(before);
  const afterText = shownShort(after);
  if (beforeText === afterText) return null;
  return {
    kind: 'short',
    label,
    line: `${label}: from ${beforeText} to ${afterText}`,
  };
}

export function questUpdateDetailEntries(
  change: QuestUpdateChange | null | undefined,
): QuestUpdateDetailEntry[] {
  if (!change) return [];
  if (change.items && change.items.length > 0) {
    return change.items.flatMap((item) => {
      const entry =
        item.format === 'text'
          ? textEntry(item.label, item.before, item.after)
          : shortEntry(item.label, item.before, item.after);
      return entry ? [entry] : [];
    });
  }
  if (change.before == null && change.after == null) return [];
  const text =
    change.format === 'text' ||
    (change.format == null && TEXT_FIELDS.has(change.field));
  const entry = text
    ? textEntry(fieldLabel(change.field), change.before, change.after)
    : shortEntry(fieldLabel(change.field), change.before, change.after);
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
