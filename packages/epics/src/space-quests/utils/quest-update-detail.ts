import type { QuestUpdateChange } from '@hypha-platform/core/client';

export type QuestUpdateListRow =
  | { kind: 'added'; text: string; label?: string }
  | { kind: 'removed'; text: string; label?: string }
  | { kind: 'changed'; before: string; after: string; label?: string };

export type QuestUpdateDetailEntry =
  | { kind: 'text'; label: string; before: string; after: string }
  | { kind: 'short'; label: string; before: string; after: string }
  | { kind: 'list'; label: string; rows: QuestUpdateListRow[] };

const TEXT_FIELDS = new Set([
  'goal',
  'scope',
  'successCriteria',
  'description',
]);

const FIELD_LABELS: Record<string, string> = {
  name: 'Title',
  goal: 'Goal',
  scope: 'Scope',
  successCriteria: 'Success criteria',
  targetDate: 'Target date',
  lead: 'Lead',
  members: 'Participants',
  rewards: 'Reward',
  milestones: 'Milestones',
  deliverables: 'Deliverables',
  description: 'Description',
  status: 'Status',
  dueDate: 'Due date',
  owner: 'Owner',
};

const BULLET_LINE = /^\s*(?:[-*•]|\d+[.)])\s+(.+)$/;

function fieldLabel(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

/** Undo TipTap escapes so the reader sees the typed characters. */
export function questUpdateDisplayText(
  value: string | null | undefined,
): string {
  const raw = value?.trim() ? value : '';
  return raw
    .replace(/\\([\\`*_{}[\]()#+.!|>~-])/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function bulletItems(text: string): string[] {
  return text
    .split('\n')
    .map((line) => BULLET_LINE.exec(line)?.[1]?.trim() ?? '')
    .filter(Boolean);
}

type TextSection = { label: string; items: string[] };

function textSections(text: string): TextSection[] {
  const sections: TextSection[] = [];
  let current: TextSection = { label: '', items: [] };
  const push = () => {
    if (current.label || current.items.length > 0) sections.push(current);
  };
  for (const line of text.split('\n')) {
    const bullet = BULLET_LINE.exec(line);
    if (bullet?.[1]) {
      current.items.push(bullet[1].trim());
      continue;
    }
    const heading = line.trim().replace(/:$/, '');
    if (!heading) continue;
    push();
    current = { label: heading, items: [] };
  }
  push();
  return sections;
}

function diffRows(
  before: readonly string[],
  after: readonly string[],
  label?: string,
): QuestUpdateListRow[] {
  const n = before.length;
  const m = after.length;
  const scores: number[][] = Array.from({ length: n + 1 }, () =>
    Array<number>(m + 1).fill(0),
  );
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      scores[i]![j] =
        before[i] === after[j]
          ? (scores[i + 1]?.[j + 1] ?? 0) + 1
          : Math.max(scores[i + 1]?.[j] ?? 0, scores[i]?.[j + 1] ?? 0);
    }
  }

  const ops: Array<{ op: 'keep' | 'del' | 'ins'; text: string }> = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      ops.push({ op: 'keep', text: before[i] ?? '' });
      i += 1;
      j += 1;
    } else if ((scores[i + 1]?.[j] ?? 0) >= (scores[i]?.[j + 1] ?? 0)) {
      ops.push({ op: 'del', text: before[i] ?? '' });
      i += 1;
    } else {
      ops.push({ op: 'ins', text: after[j] ?? '' });
      j += 1;
    }
  }
  while (i < n) ops.push({ op: 'del', text: before[i++] ?? '' });
  while (j < m) ops.push({ op: 'ins', text: after[j++] ?? '' });

  const rows: QuestUpdateListRow[] = [];
  for (let index = 0; index < ops.length; index += 1) {
    const op = ops[index];
    const next = ops[index + 1];
    if (!op || op.op === 'keep') continue;
    if (op.op === 'del' && next?.op === 'ins') {
      rows.push({
        kind: 'changed',
        before: op.text,
        after: next.text,
        ...(label ? { label } : {}),
      });
      index += 1;
      continue;
    }
    if (op.op === 'ins' && next?.op === 'del') {
      rows.push({
        kind: 'changed',
        before: next.text,
        after: op.text,
        ...(label ? { label } : {}),
      });
      index += 1;
      continue;
    }
    rows.push(
      op.op === 'del'
        ? { kind: 'removed', text: op.text, ...(label ? { label } : {}) }
        : { kind: 'added', text: op.text, ...(label ? { label } : {}) },
    );
  }
  return rows;
}

function listDiff(before: string, after: string): QuestUpdateListRow[] | null {
  const left = textSections(before);
  const right = textSections(after);
  const leftCount = left.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );
  const rightCount = right.reduce(
    (sum, section) => sum + section.items.length,
    0,
  );
  if (leftCount + rightCount === 0) return null;
  if (
    leftCount + rightCount === 1 &&
    bulletItems(before).length + bulletItems(after).length === 0
  ) {
    return null;
  }

  const labels = [
    ...new Set([
      ...left.map((section) => section.label),
      ...right.map((section) => section.label),
    ]),
  ];
  if (labels.length === 1 && labels[0] === '') {
    return diffRows(left[0]?.items ?? [], right[0]?.items ?? []);
  }
  return labels.flatMap((label) =>
    diffRows(
      left
        .filter((section) => section.label === label)
        .flatMap((section) => section.items),
      right
        .filter((section) => section.label === label)
        .flatMap((section) => section.items),
      label || undefined,
    ),
  );
}

function textOrListEntry(
  label: string,
  before: string,
  after: string,
): QuestUpdateDetailEntry | null {
  if (before === after) return null;
  const rows = listDiff(before, after);
  if (rows && rows.length > 0) return { kind: 'list', label, rows };
  if (rows && bulletItems(before).length + bulletItems(after).length > 0) {
    return null;
  }
  return { kind: 'text', label, before, after };
}

export function questUpdateDetailEntries(
  change: QuestUpdateChange | null | undefined,
): QuestUpdateDetailEntry[] {
  if (!change) return [];
  if (change.items && change.items.length > 0) {
    const rows: QuestUpdateListRow[] = [];
    const entries: QuestUpdateDetailEntry[] = [];
    for (const item of change.items) {
      const before = questUpdateDisplayText(item.before);
      const after = questUpdateDisplayText(item.after);
      if (item.format === 'text' || TEXT_FIELDS.has(item.label)) {
        const entry = textOrListEntry(item.label, before, after);
        if (entry) entries.push(entry);
        continue;
      }
      if (item.action === 'added') {
        const text = after || item.label;
        if (text) rows.push({ kind: 'added', text, label: item.label });
        continue;
      }
      if (item.action === 'removed') {
        const text = before || item.label;
        if (text) rows.push({ kind: 'removed', text, label: item.label });
        continue;
      }
      if (before === after) continue;
      entries.push({
        kind: 'short',
        label: item.label,
        before: before || 'none',
        after: after || 'none',
      });
    }
    if (rows.length > 0) {
      entries.unshift({
        kind: 'list',
        label: fieldLabel(change.field),
        rows,
      });
    }
    return entries;
  }

  const before = questUpdateDisplayText(change.before);
  const after = questUpdateDisplayText(change.after);
  if (!before && !after) return [];
  if (before === after) return [];
  const label = fieldLabel(change.field);
  if (change.format === 'text' || TEXT_FIELDS.has(change.field)) {
    const entry = textOrListEntry(label, before, after);
    return entry ? [entry] : [];
  }
  return [
    {
      kind: 'short',
      label,
      before: before || 'none',
      after: after || 'none',
    },
  ];
}

export function questUpdateDetailIsLong(
  entries: readonly QuestUpdateDetailEntry[],
): boolean {
  const text = entries
    .map((entry) => {
      if (entry.kind === 'list') {
        return entry.rows
          .map((row) =>
            row.kind === 'changed' ? `${row.before} ${row.after}` : row.text,
          )
          .join('\n');
      }
      if (entry.kind === 'short') return `${entry.before} ${entry.after}`;
      return `${entry.before}\n${entry.after}`;
    })
    .join('\n');
  return text.length > 240 || text.split('\n').length > 8;
}
