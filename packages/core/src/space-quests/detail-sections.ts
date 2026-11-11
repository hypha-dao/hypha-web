import type { QuestMilestoneStatus, QuestStatus } from './constants';
import { canMemberEditQuest } from './markdown';
import type { QuestRecord } from './types';

/**
 * Drop `<...>` spans in one forward pass. Equivalent to replacing
 * `/<[^>]*>/g`, which is quadratic on a long run of `<`. This is a presence
 * scan, not an HTML sanitizer: callers still render the original markup.
 */
function withoutAngleTagSpans(value: string): string {
  let out = '';
  let index = 0;
  while (index < value.length) {
    const open = value.indexOf('<', index);
    if (open < 0) {
      out += value.slice(index);
      break;
    }
    out += value.slice(index, open);
    const close = value.indexOf('>', open + 1);
    if (close < 0) {
      out += value.slice(open);
      break;
    }
    out += ' ';
    index = close + 1;
  }
  return out;
}

/**
 * Whether tag-stripped rich text still has characters. Empty editor shells
 * (`<p></p>`, `<p><br></p>`) do not. The result is not safe to inject as HTML.
 */
export function questHtmlHasVisibleText(
  value: string | null | undefined,
): boolean {
  return withoutAngleTagSpans(value ?? '').trim().length > 0;
}

function hasText(value: string | null | undefined): boolean {
  const plain = withoutAngleTagSpans(value ?? '')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, ' $1 ')
    .replace(/https?:\/\/\S+/gi, ' link ')
    .replace(/(^|\s)[-•*](?=\s|$)/g, ' ')
    .replace(/[#>*_`~]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return plain.length > 0;
}

function hasItems(values: readonly string[] | null | undefined): boolean {
  return (values ?? []).some((item) => hasText(item));
}

export type QuestOverviewVisibility = {
  showGoal: boolean;
  showScopeIn: boolean;
  showScopeOut: boolean;
  showSuccess: boolean;
  showScopeCard: boolean;
  showRewards: boolean;
  showMilestones: boolean;
  showMembers: boolean;
  showDeliverables: boolean;
  showHealth: boolean;
  showTargetDate: boolean;
};

/**
 * Optional overview cards hide when they have no content.
 * Health and the quest title stay. Create-draft inputs are a different surface.
 */
export function questOverviewVisibility(quest: {
  status: QuestStatus;
  goal?: string | null;
  scopeIn?: readonly string[] | null;
  scopeOut?: readonly string[] | null;
  scopeInMarkdown?: string | null;
  scopeOutMarkdown?: string | null;
  successCriteria?: string | null;
  rewards?: readonly unknown[] | null;
  milestones?: readonly unknown[] | null;
  members?: readonly unknown[] | null;
  deliverables?: readonly unknown[] | null;
  targetDate?: string | null;
}): QuestOverviewVisibility {
  const showGoal = hasText(quest.goal);
  const showScopeIn = hasItems(quest.scopeIn) || hasText(quest.scopeInMarkdown);
  const showScopeOut =
    hasItems(quest.scopeOut) || hasText(quest.scopeOutMarkdown);
  const showSuccess = hasText(quest.successCriteria);
  return {
    showGoal,
    showScopeIn,
    showScopeOut,
    showSuccess,
    showScopeCard: showGoal || showScopeIn || showScopeOut || showSuccess,
    showRewards: (quest.rewards?.length ?? 0) > 0,
    showMilestones: (quest.milestones?.length ?? 0) > 0,
    showMembers: (quest.members?.length ?? 0) > 0,
    showDeliverables: (quest.deliverables?.length ?? 0) > 0,
    showHealth: true,
    showTargetDate: hasText(quest.targetDate),
  };
}

export type MilestoneStatusSource = {
  id?: number;
  name: string;
  description?: string | null;
  dueDate?: string | null;
  ownerPersonId?: number | null;
  ownerName?: string | null;
  status: QuestMilestoneStatus;
};

/**
 * One milestone status change, with every other field copied through.
 * Unknown ids and statuses produce no patch.
 */
export type MilestoneStatusPatchItem = {
  id?: number;
  name: string;
  description: string;
  dueDate: string | null;
  ownerPersonId: number | null;
  ownerName: string | null;
  status: QuestMilestoneStatus;
};

export function buildMilestoneStatusPatch(
  milestones: readonly MilestoneStatusSource[],
  milestoneId: number,
  status: QuestMilestoneStatus,
): { milestones: MilestoneStatusPatchItem[] } | null {
  const target = milestones.find((milestone) => milestone.id === milestoneId);
  if (!target || target.status === status) return null;
  return {
    milestones: milestones.map((milestone) => ({
      ...(typeof milestone.id === 'number' ? { id: milestone.id } : {}),
      name: milestone.name,
      description: milestone.description ?? '',
      dueDate: milestone.dueDate ?? null,
      ownerPersonId: milestone.ownerPersonId ?? null,
      ownerName: milestone.ownerName ?? null,
      status: milestone.id === milestoneId ? status : milestone.status,
    })),
  };
}

/**
 * Same people who can edit quest content can change milestone status.
 * Proposed, archived, and non-members cannot.
 */
export function canChangeMilestoneStatus(
  viewer: { id?: number | null; name?: string | null } | null | undefined,
  quest: Pick<QuestRecord, 'leadPersonId' | 'leadName' | 'members' | 'status'>,
): boolean {
  if (quest.status !== 'active' && quest.status !== 'paused') return false;
  return canMemberEditQuest(viewer, quest);
}

export function milestoneEditorChrome(count: number): {
  addLabel: string;
  showInsertHint: boolean;
} {
  if (count <= 0) {
    return { addLabel: 'Add milestone', showInsertHint: false };
  }
  return { addLabel: 'Add milestone', showInsertHint: true };
}
