import type {
  QuestDeliverableRecord,
  QuestMemberRecord,
  QuestMilestoneRecord,
  QuestReward,
  QuestUpdateChange,
  QuestUpdateChangeItem,
} from './types';

type Named = { id?: number | null };

function trimmed(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function textChange(
  field: string,
  before: string,
  after: string,
): QuestUpdateChange {
  return {
    entity: 'quest',
    field,
    action: 'updated',
    format: 'text',
    before,
    after,
  };
}

function shortChange(
  field: string,
  before: string | null | undefined,
  after: string | null | undefined,
): QuestUpdateChange {
  return {
    entity: 'quest',
    field,
    action: 'updated',
    format: 'short',
    before: trimmed(before) || null,
    after: trimmed(after) || null,
  };
}

export function questScopeChangeText(input: {
  scopeInMarkdown?: string | null;
  scopeOutMarkdown?: string | null;
  scopeIn?: readonly string[];
  scopeOut?: readonly string[];
}): string {
  const bullets = (items: readonly string[] | undefined) =>
    (items ?? [])
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => `- ${item}`)
      .join('\n');
  const scopeIn = trimmed(input.scopeInMarkdown) || bullets(input.scopeIn);
  const scopeOut = trimmed(input.scopeOutMarkdown) || bullets(input.scopeOut);
  return `In:\n${scopeIn || 'none'}\n\nOut:\n${scopeOut || 'none'}`;
}

export function questRewardChangeText(rewards: readonly QuestReward[]): string {
  const parts = rewards
    .map((reward) =>
      `${trimmed(reward.amount)} ${trimmed(reward.token)}`.trim(),
    )
    .filter(Boolean);
  return parts.join(', ') || 'none';
}

export function questGoalChange(
  before: string,
  after: string,
): QuestUpdateChange {
  return textChange('goal', before, after);
}

export function questScopeChange(
  before: string,
  after: string,
): QuestUpdateChange {
  return textChange('scope', before, after);
}

export function questSuccessChange(
  before: string,
  after: string,
): QuestUpdateChange {
  return textChange('successCriteria', before, after);
}

export function questNameChange(
  before: string,
  after: string,
): QuestUpdateChange {
  return shortChange('name', before, after);
}

export function questStatusChange(
  before: string,
  after: string,
): QuestUpdateChange {
  return shortChange('status', before, after);
}

export function questTargetDateChange(
  before: string | null | undefined,
  after: string | null | undefined,
): QuestUpdateChange {
  return shortChange('targetDate', before, after);
}

export function questLeadChange(
  before: string,
  after: string,
): QuestUpdateChange {
  return shortChange('lead', before, after);
}

export function questRewardChange(
  before: readonly QuestReward[],
  after: readonly QuestReward[],
): QuestUpdateChange {
  return shortChange(
    'rewards',
    questRewardChangeText(before),
    questRewardChangeText(after),
  );
}

function shortItem(
  label: string,
  action: QuestUpdateChangeItem['action'],
  before: string | null | undefined,
  after: string | null | undefined,
): QuestUpdateChangeItem {
  return {
    label,
    format: 'short',
    action,
    before: trimmed(before) || null,
    after: trimmed(after) || null,
  };
}

function textItem(
  label: string,
  before: string,
  after: string,
): QuestUpdateChangeItem {
  return {
    label,
    format: 'text',
    action: 'updated',
    before,
    after,
  };
}

function pushShort(
  items: QuestUpdateChangeItem[],
  label: string,
  before: string | null | undefined,
  after: string | null | undefined,
) {
  if (trimmed(before) === trimmed(after)) return;
  items.push(shortItem(label, 'updated', before, after));
}

function listKeys<T extends Named>(
  items: readonly T[],
  nameOf: (item: T) => string,
): string[] {
  const nameCounts = new Map<string, number>();
  return items.map((item) => {
    if (typeof item.id === 'number') return `id:${item.id}`;
    const name = nameOf(item).trim().toLowerCase();
    const seen = nameCounts.get(name) ?? 0;
    nameCounts.set(name, seen + 1);
    return `name:${name}#${seen}`;
  });
}

function orderChanged(
  beforeKeys: readonly string[],
  afterKeys: readonly string[],
) {
  const beforeSet = new Set(beforeKeys);
  const afterSet = new Set(afterKeys);
  const beforeSurvivors = beforeKeys.filter((key) => afterSet.has(key));
  const afterSurvivors = afterKeys.filter((key) => beforeSet.has(key));
  if (beforeSurvivors.length < 2) return false;
  return beforeSurvivors.some((key, index) => key !== afterSurvivors[index]);
}

function pairByKey<B extends Named, A extends Named>(
  before: readonly B[],
  after: readonly A[],
  nameOf: (item: B | A) => string,
): {
  pairs: Array<{ before: B; after: A }>;
  added: A[];
  removed: B[];
} {
  const beforeKeys = listKeys(before, nameOf);
  const afterKeys = listKeys(after, nameOf);
  const usedBefore = new Set<number>();
  const pairs: Array<{ before: B; after: A }> = [];
  const unmatched: A[] = [];

  const takeBefore = (index: number) => {
    usedBefore.add(index);
    const prior = before[index];
    if (!prior) throw new Error('Missing quest change row');
    return prior;
  };

  after.forEach((item, index) => {
    const key = afterKeys[index] ?? '';
    const byKey = beforeKeys.findIndex(
      (candidate, candidateIndex) =>
        !usedBefore.has(candidateIndex) && candidate === key,
    );
    if (byKey >= 0) {
      pairs.push({ before: takeBefore(byKey), after: item });
      return;
    }
    unmatched.push(item);
  });

  const added: A[] = [];
  for (const item of unmatched) {
    const name = nameOf(item).trim().toLowerCase();
    const byName =
      name.length === 0
        ? -1
        : before.findIndex(
            (candidate, candidateIndex) =>
              !usedBefore.has(candidateIndex) &&
              nameOf(candidate).trim().toLowerCase() === name,
          );
    if (byName >= 0) {
      pairs.push({ before: takeBefore(byName), after: item });
      continue;
    }
    added.push(item);
  }

  const removed = before.filter((_, index) => !usedBefore.has(index));
  return { pairs, added, removed };
}

function withItems(
  change: QuestUpdateChange,
  items: QuestUpdateChangeItem[],
): QuestUpdateChange {
  return items.length > 0 ? { ...change, items } : change;
}

type MilestoneInput = {
  id?: number;
  name: string;
  description?: string;
  dueDate?: string | null;
  ownerName?: string | null;
  status?: string;
};

export function questMilestoneChange(
  before: readonly QuestMilestoneRecord[],
  after: readonly MilestoneInput[],
): QuestUpdateChange {
  const nameOf = (item: { name?: string }) => item.name ?? '';
  const { pairs, added, removed } = pairByKey(before, after, nameOf);
  const items: QuestUpdateChangeItem[] = [];
  if (orderChanged(listKeys(before, nameOf), listKeys(after, nameOf))) {
    items.push(
      shortItem(
        'Order',
        'reordered',
        before
          .map((item, index) => `M${index + 1} ${trimmed(item.name)}`)
          .join(', '),
        after
          .map((item, index) => `M${index + 1} ${trimmed(item.name)}`)
          .join(', '),
      ),
    );
  }
  for (const item of added) {
    items.push(shortItem('Milestone', 'added', null, item.name));
  }
  for (const item of removed) {
    items.push(shortItem('Milestone', 'removed', item.name, null));
  }
  for (const pair of pairs) {
    const label =
      trimmed(pair.after.name) || trimmed(pair.before.name) || 'Milestone';
    pushShort(items, `${label} name`, pair.before.name, pair.after.name);
    if (trimmed(pair.before.description) !== trimmed(pair.after.description)) {
      items.push(
        textItem(
          `${label} description`,
          pair.before.description ?? '',
          pair.after.description ?? '',
        ),
      );
    }
    pushShort(
      items,
      `${label} status`,
      pair.before.status,
      pair.after.status ?? 'not_started',
    );
    pushShort(
      items,
      `${label} due date`,
      pair.before.dueDate,
      pair.after.dueDate,
    );
    pushShort(
      items,
      `${label} owner`,
      pair.before.ownerName,
      pair.after.ownerName,
    );
  }
  return withItems(
    {
      entity: 'milestone',
      field: 'milestones',
      action: 'updated',
    },
    items,
  );
}

type MemberInput = {
  id?: number;
  personId?: number | null;
  memberName: string;
  roleLabel?: string | null;
  responsibilities?: string[];
};

function responsibilityText(
  items: readonly string[] | null | undefined,
): string {
  return (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean)
    .join('\n');
}

export function questMemberChange(
  before: readonly QuestMemberRecord[],
  after: readonly MemberInput[],
): QuestUpdateChange {
  const nameOf = (item: { memberName?: string }) => item.memberName ?? '';
  const { pairs, added, removed } = pairByKey(before, after, nameOf);
  const items: QuestUpdateChangeItem[] = [];
  if (orderChanged(listKeys(before, nameOf), listKeys(after, nameOf))) {
    items.push(
      shortItem(
        'Order',
        'reordered',
        before.map((item) => trimmed(item.memberName)).join(', '),
        after.map((item) => trimmed(item.memberName)).join(', '),
      ),
    );
  }
  for (const item of added) {
    items.push(shortItem('Participant', 'added', null, item.memberName));
  }
  for (const item of removed) {
    items.push(shortItem('Participant', 'removed', item.memberName, null));
  }
  for (const pair of pairs) {
    const label =
      trimmed(pair.after.memberName) ||
      trimmed(pair.before.memberName) ||
      'Participant';
    pushShort(
      items,
      `${label} name`,
      pair.before.memberName,
      pair.after.memberName,
    );
    pushShort(
      items,
      `${label} role`,
      pair.before.roleLabel,
      pair.after.roleLabel,
    );
    const beforeNotes = responsibilityText(pair.before.responsibilities);
    const afterNotes = responsibilityText(pair.after.responsibilities);
    if (beforeNotes !== afterNotes) {
      items.push(
        textItem(`${label} responsibilities`, beforeNotes, afterNotes),
      );
    }
  }
  return withItems(
    {
      entity: 'member',
      field: 'members',
      action: 'updated',
    },
    items,
  );
}

type DeliverableInput = {
  id?: number;
  name: string;
  url?: string | null;
  note?: string | null;
};

export function questDeliverableChange(
  before: readonly QuestDeliverableRecord[],
  after: readonly DeliverableInput[],
): QuestUpdateChange {
  const nameOf = (item: { name?: string }) => item.name ?? '';
  const { pairs, added, removed } = pairByKey(before, after, nameOf);
  const items: QuestUpdateChangeItem[] = [];
  if (orderChanged(listKeys(before, nameOf), listKeys(after, nameOf))) {
    items.push(
      shortItem(
        'Order',
        'reordered',
        before.map((item) => trimmed(item.name)).join(', '),
        after.map((item) => trimmed(item.name)).join(', '),
      ),
    );
  }
  for (const item of added) {
    items.push(shortItem('Deliverable', 'added', null, item.name));
  }
  for (const item of removed) {
    items.push(shortItem('Deliverable', 'removed', item.name, null));
  }
  for (const pair of pairs) {
    const label =
      trimmed(pair.before.name) || trimmed(pair.after.name) || 'Deliverable';
    pushShort(items, `${label} name`, pair.before.name, pair.after.name);
    pushShort(items, `${label} link`, pair.before.url, pair.after.url);
    pushShort(items, `${label} note`, pair.before.note, pair.after.note);
  }
  return withItems(
    {
      entity: 'deliverable',
      field: 'deliverables',
      action: 'updated',
    },
    items,
  );
}
