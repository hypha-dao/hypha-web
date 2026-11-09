import {
  bulletsToMarkdownList,
  questEditRequestSection,
  splitMarkdownLinesToBullets,
  type QuestStewardStep,
  type schemaPatchSpaceQuest,
} from '@hypha-platform/core/client';
import type { z } from 'zod';
import type { QuestSpaceMember } from '../hooks/use-space-quests';
import {
  QUEST_EDIT_NOT_FILED_REPLY,
  replyWithoutUnbackedEditClaim,
  settleCreateDraftTurn,
  type PendingQuestSectionProposal,
  type QuestDraftModelTurn,
  type QuestDraftStateSnapshot,
  type QuestDraftTurnHistoryItem,
} from './quest-draft-assistant';
import { storedQuestRichText } from './quest-rich-text';

type QuestPatch = z.infer<typeof schemaPatchSpaceQuest>;

type SavedQuestSource = {
  name: string;
  goal: string;
  scopeIn: string[];
  scopeOut: string[];
  scopeInMarkdown: string;
  scopeOutMarkdown: string;
  successCriteria: string;
  rewards: QuestDraftStateSnapshot['rewards'];
  targetDate: string | null;
  leadPersonId: number | null;
  leadName: string;
  milestones: Array<{
    id?: number;
    name: string;
    description: string;
    dueDate: string | null;
    ownerPersonId?: number | null;
    ownerName: string | null;
    status: QuestDraftStateSnapshot['milestones'][number]['status'];
  }>;
  members: Array<{
    id?: number;
    personId?: number | null;
    memberName: string;
    memberAvatarUrl?: string | null;
    roleLabel?: string | null;
    responsibilities: string[];
  }>;
};

/**
 * Opening line for the helper on a quest that is already saved.
 * The create screen keeps its own first question.
 */
export const SAVED_QUEST_HELPER_INTRO =
  'This quest is already saved. Tell me which section to change — Goal, Scope, Success, Milestones, Participants, Lead, Target Date, Rewards, or the name. I will suggest one section, and yes saves only that section.';

export const SAVED_QUEST_HELPER_SAVE_FAILED =
  'Could not save that section. It is not saved yet. Yes still applies the suggestion that was waiting.';

export const SAVED_QUEST_HELPER_NOT_SAVED =
  'Nothing was saved. The suggestion is still waiting on a yes.';

export const SAVED_QUEST_HELPER_UNCHANGED =
  'That section already matches the saved quest, so nothing was saved.';

/** A filled quest has no empty section, so the create-screen "submit" line does not apply. */
export const SAVED_QUEST_HELPER_SAVED =
  'Saved that section. Tell me the next section to change.';

export const SAVED_QUEST_HELPER_NOTHING_PENDING =
  'Nothing is waiting to confirm.';

export function savedQuestSectionReply(patch: QuestPatch): string {
  if (patch.goal !== undefined) return 'Saved the Goal.';
  if (
    patch.scopeIn !== undefined ||
    patch.scopeOut !== undefined ||
    patch.scopeInMarkdown !== undefined ||
    patch.scopeOutMarkdown !== undefined
  ) {
    return 'Saved the Scope.';
  }
  if (patch.successCriteria !== undefined) return 'Saved the Success criteria.';
  if (patch.milestones !== undefined) return 'Saved the Milestones.';
  if (patch.members !== undefined) return 'Saved the Participants.';
  if (patch.leadName !== undefined || patch.leadPersonId !== undefined) {
    return 'Saved the Lead.';
  }
  if (patch.targetDate !== undefined) return 'Saved the Target date.';
  if (patch.rewards !== undefined) return 'Saved the Quest Reward.';
  if (patch.name !== undefined) return 'Saved the Name.';
  return SAVED_QUEST_HELPER_SAVED;
}

export type SavedHelperWritePlan =
  | { kind: 'save'; patch: QuestPatch }
  | { kind: 'unchanged' }
  | { kind: 'blocked' };

export type SavedQuestHelperTurn = {
  reply: string;
  pending: PendingQuestSectionProposal | null;
  focusStep: QuestStewardStep;
  saved: boolean;
};

/** The helper reads the quest that is already stored, not an empty create draft. */
export function questRecordToDraftSnapshot(
  quest: SavedQuestSource,
): QuestDraftStateSnapshot {
  return {
    name: quest.name,
    goal: quest.goal,
    scopeIn: [...quest.scopeIn],
    scopeOut: [...quest.scopeOut],
    scopeInMarkdown: quest.scopeInMarkdown,
    scopeOutMarkdown: quest.scopeOutMarkdown,
    successCriteria: quest.successCriteria,
    rewards: quest.rewards.map((reward) => ({ ...reward })),
    milestones: quest.milestones.map((milestone) => ({
      id: milestone.id,
      name: milestone.name,
      description: milestone.description,
      dueDate: milestone.dueDate,
      ownerPersonId: milestone.ownerPersonId ?? null,
      ownerName: milestone.ownerName,
      status: milestone.status,
    })),
    leadName: quest.leadName,
    selectedLeadPersonId: quest.leadPersonId,
    members: quest.members.map((member) => ({
      id: member.id,
      personId: member.personId ?? null,
      memberName: member.memberName,
      memberAvatarUrl: member.memberAvatarUrl ?? null,
      roleLabel: member.roleLabel ?? null,
      responsibilities: [...member.responsibilities],
    })),
    targetDate: quest.targetDate,
  };
}

type AssistHistory = { role: 'user' | 'assistant'; text: string };

/**
 * Same draft-assist body as the create helper. `questSlug` stays off this
 * body so the server coaches a suggestion instead of writing the quest.
 */
export function questHelperDraftAssistBody({
  message,
  currentStep,
  spaceTitle,
  draft,
  spaceMembers,
  history,
  pendingSuggestion,
}: {
  message: string;
  currentStep: QuestStewardStep;
  spaceTitle?: string;
  draft: QuestDraftStateSnapshot;
  spaceMembers: readonly Pick<QuestSpaceMember, 'personId' | 'name'>[];
  history: AssistHistory[];
  pendingSuggestion: {
    status: 'none' | 'awaiting' | 'retired' | 'revising';
    step?: QuestStewardStep;
    wording?: string;
  };
}) {
  return {
    message,
    currentStep,
    spaceTitle,
    draft: {
      name: draft.name,
      goal: draft.goal,
      scopeIn: draft.scopeIn,
      scopeOut: draft.scopeOut,
      successCriteria: draft.successCriteria,
      targetDate: draft.targetDate,
      leadName: draft.leadName,
      rewards: draft.rewards,
      milestones: draft.milestones.map((milestone) => ({
        name: milestone.name,
        dueDate: milestone.dueDate,
        description: milestone.description,
        ownerName: milestone.ownerName,
      })),
      members: draft.members.map((member) => ({
        memberName: member.memberName,
        roleLabel: member.roleLabel,
        responsibilities: member.responsibilities,
      })),
    },
    spaceMembers: spaceMembers.slice(0, 60).map((member) => ({
      personId: member.personId,
      name: member.name,
    })),
    history,
    pendingSuggestion,
  };
}

function questMarkdownIsList(markdown: string): boolean {
  const lines = markdown
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return (
    lines.length > 0 &&
    lines.every((line) => /^(?:[-*•]|\d+[.)])\s+/.test(line))
  );
}

function userAskedForList(message: string): boolean {
  return /\b(?:bullets?|as a list|into a list|make (?:it |this |that |them )?a list)\b/i.test(
    message,
  );
}

/** A trailing period the member did not type and the saved text did not have. */
function stripUnaskedPeriod(
  item: string,
  before: string,
  message: string,
): string {
  const trimmed = item.trim();
  if (!trimmed.endsWith('.') || trimmed.endsWith('...')) return trimmed;
  if (message.includes(trimmed) || before.includes(trimmed)) return trimmed;
  return trimmed.slice(0, -1).trimEnd();
}

/**
 * Keep a paragraph as a paragraph, and a list as a list.
 * An edit has to ask for bullets before a paragraph becomes a list.
 */
export function preserveQuestMarkdown(
  before: string,
  after: string,
  message: string,
): string {
  const items = splitMarkdownLinesToBullets(after)
    .map((item) => stripUnaskedPeriod(item, before, message))
    .filter(Boolean);
  if (items.length === 0) return after.trim();
  const asList =
    userAskedForList(message) || questMarkdownIsList(before) || !before.trim();
  if (asList) return bulletsToMarkdownList(items);
  if (!before.includes('\n')) return items.join(' ');
  return items.join('\n');
}

function alignSavedListReply(
  reply: string,
  draft: QuestDraftStateSnapshot,
  message: string,
  step: QuestStewardStep,
): string {
  const before =
    step === 'scope'
      ? `${draft.scopeInMarkdown}\n${draft.scopeOutMarkdown}`
      : step === 'success'
      ? draft.successCriteria
      : '';
  if (!before.trim()) return reply;
  const asList = userAskedForList(message) || questMarkdownIsList(before);
  return reply
    .split('\n')
    .map((line) => {
      const bullet = /^([-*•]|\d+[.)])\s+(.*)$/.exec(line.trim());
      if (!bullet?.[2]) return line;
      const item = stripUnaskedPeriod(bullet[2], before, message);
      return asList ? `${bullet[1]} ${item}` : item;
    })
    .join('\n');
}

function sameList(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((item, index) => item === right[index])
  );
}

function takeUnused<T>(
  items: readonly T[],
  used: Set<number>,
  match: (item: T) => boolean,
): T | undefined {
  for (let index = 0; index < items.length; index += 1) {
    if (used.has(index)) continue;
    const item = items[index];
    if (item !== undefined && match(item)) {
      used.add(index);
      return item;
    }
  }
  return undefined;
}

function milestonePayload(
  before: QuestDraftStateSnapshot,
  after: QuestDraftStateSnapshot,
): NonNullable<QuestPatch['milestones']> {
  const used = new Set<number>();
  return after.milestones
    .map((milestone) => {
      const prior = takeUnused(
        before.milestones,
        used,
        (candidate) =>
          candidate.name.trim().toLowerCase() ===
          milestone.name.trim().toLowerCase(),
      );
      const name = milestone.name.trim();
      if (!name) return null;
      return {
        ...(typeof prior?.id === 'number' ? { id: prior.id } : {}),
        ...(typeof milestone.id === 'number' && prior?.id === undefined
          ? { id: milestone.id }
          : {}),
        name,
        description: storedQuestRichText(milestone.description),
        dueDate: milestone.dueDate?.trim() || null,
        ownerPersonId: milestone.ownerPersonId ?? prior?.ownerPersonId ?? null,
        ownerName: milestone.ownerName?.trim() || null,
        status: prior?.status ?? milestone.status,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

function memberPayload(
  before: QuestDraftStateSnapshot,
  after: QuestDraftStateSnapshot,
): NonNullable<QuestPatch['members']> {
  const used = new Set<number>();
  return after.members
    .map((member) => {
      const name = member.memberName.trim();
      if (!name) return null;
      const prior = takeUnused(
        before.members,
        used,
        (candidate) =>
          candidate.memberName.trim().toLowerCase() === name.toLowerCase(),
      );
      return {
        ...(typeof prior?.id === 'number' ? { id: prior.id } : {}),
        personId: member.personId ?? prior?.personId ?? null,
        memberName: name,
        memberAvatarUrl:
          member.memberAvatarUrl ?? prior?.memberAvatarUrl ?? null,
        roleLabel: member.roleLabel?.trim() || null,
        responsibilities: member.responsibilities
          .map((item) => item.trim())
          .filter(Boolean),
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);
}

function rewardPayload(
  rewards: QuestDraftStateSnapshot['rewards'],
): NonNullable<QuestPatch['rewards']> {
  return rewards
    .filter((reward) => reward.amount.trim() && reward.token.trim())
    .map((reward) => ({
      amount: reward.amount.trim(),
      token: reward.token.trim().toUpperCase(),
    }));
}

/**
 * One changed section, stored the same way the section editors store it.
 * More than one section, or a lead with no person, does not save.
 */
export function planSavedHelperWrite(
  before: QuestDraftStateSnapshot,
  after: QuestDraftStateSnapshot,
  message = '',
): SavedHelperWritePlan {
  const sections: Array<{ patch: QuestPatch }> = [];

  const name = after.name.trim();
  if (name && name !== before.name.trim()) {
    sections.push({ patch: { name } });
  }

  const goal = storedQuestRichText(after.goal);
  if (goal !== before.goal.trim()) {
    sections.push({ patch: { goal } });
  }

  const beforeScopeInMarkdown = storedQuestRichText(before.scopeInMarkdown);
  const beforeScopeOutMarkdown = storedQuestRichText(before.scopeOutMarkdown);
  const scopeInMarkdown = preserveQuestMarkdown(
    beforeScopeInMarkdown,
    storedQuestRichText(after.scopeInMarkdown),
    message,
  );
  const scopeOutMarkdown = preserveQuestMarkdown(
    beforeScopeOutMarkdown,
    storedQuestRichText(after.scopeOutMarkdown),
    message,
  );
  const scopeIn = splitMarkdownLinesToBullets(scopeInMarkdown);
  const scopeOut = splitMarkdownLinesToBullets(scopeOutMarkdown);
  if (
    scopeInMarkdown !== beforeScopeInMarkdown ||
    scopeOutMarkdown !== beforeScopeOutMarkdown ||
    !sameList(scopeIn, splitMarkdownLinesToBullets(beforeScopeInMarkdown)) ||
    !sameList(scopeOut, splitMarkdownLinesToBullets(beforeScopeOutMarkdown))
  ) {
    sections.push({
      patch: { scopeIn, scopeOut, scopeInMarkdown, scopeOutMarkdown },
    });
  }

  const beforeSuccess = storedQuestRichText(before.successCriteria);
  const successCriteria = preserveQuestMarkdown(
    beforeSuccess,
    storedQuestRichText(after.successCriteria),
    message,
  );
  if (successCriteria !== beforeSuccess) {
    sections.push({ patch: { successCriteria } });
  }

  const milestones = milestonePayload(before, after);
  const beforeMilestones = milestonePayload(before, before);
  if (JSON.stringify(milestones) !== JSON.stringify(beforeMilestones)) {
    sections.push({ patch: { milestones } });
  }

  const members = memberPayload(before, after);
  const beforeMembers = memberPayload(before, before);
  if (JSON.stringify(members) !== JSON.stringify(beforeMembers)) {
    sections.push({ patch: { members } });
  }

  const leadName = after.leadName.trim();
  const leadPersonId = after.selectedLeadPersonId;
  const leadChanged =
    leadName !== before.leadName.trim() ||
    (leadPersonId ?? null) !== (before.selectedLeadPersonId ?? null);
  if (leadChanged) {
    if (leadPersonId == null) return { kind: 'blocked' };
    sections.push({ patch: { leadName, leadPersonId } });
  }

  const targetDate = after.targetDate?.trim() || null;
  if (targetDate !== (before.targetDate?.trim() || null)) {
    sections.push({ patch: { targetDate } });
  }

  const rewards = rewardPayload(after.rewards);
  if (
    JSON.stringify(rewards) !== JSON.stringify(rewardPayload(before.rewards))
  ) {
    sections.push({ patch: { rewards } });
  }

  if (sections.length === 0) return { kind: 'unchanged' };
  if (sections.length > 1) return { kind: 'blocked' };
  return { kind: 'save', patch: sections[0]!.patch };
}

/**
 * One saved-quest helper turn. A confirmed section is saved by the caller.
 * Chat, a failed save, and a patch that is not exactly one section leave
 * the stored quest alone.
 */
export async function runSavedQuestHelperTurn({
  message,
  history = [],
  viewerDisplayName,
  spaceMembers,
  readState,
  isCurrent,
  loadModel,
  saveSection,
}: {
  message: string;
  history?: readonly QuestDraftTurnHistoryItem[];
  viewerDisplayName: string;
  spaceMembers: readonly QuestSpaceMember[];
  readState: () => {
    draft: QuestDraftStateSnapshot;
    pending: PendingQuestSectionProposal | null;
    currentStep: QuestStewardStep;
  };
  isCurrent: () => boolean;
  loadModel: () => Promise<QuestDraftModelTurn | null>;
  saveSection: (patch: QuestPatch) => Promise<boolean>;
}): Promise<SavedQuestHelperTurn | null> {
  const settled = await settleCreateDraftTurn({
    message,
    history,
    viewerDisplayName,
    spaceMembers,
    readState,
    isCurrent,
    loadModel,
    voice: 'saved',
  });
  if (!settled || !isCurrent()) return null;
  if (!settled.wrote) {
    const latest = readState();
    let reply = settled.reply;
    if (!settled.pending && questEditRequestSection(message)) {
      reply =
        replyWithoutUnbackedEditClaim(reply) || QUEST_EDIT_NOT_FILED_REPLY;
    }
    if (settled.pending) {
      reply = alignSavedListReply(
        reply,
        latest.draft,
        message,
        settled.pending.step,
      );
    }
    return {
      reply,
      pending: settled.pending,
      focusStep: settled.focusStep,
      saved: false,
    };
  }

  const latest = readState();
  const plan = planSavedHelperWrite(latest.draft, settled.draft, message);
  if (plan.kind === 'unchanged') {
    return {
      reply: SAVED_QUEST_HELPER_UNCHANGED,
      pending: null,
      focusStep: settled.focusStep,
      saved: false,
    };
  }
  if (plan.kind === 'blocked') {
    return {
      reply: SAVED_QUEST_HELPER_NOT_SAVED,
      pending: latest.pending,
      focusStep: latest.pending?.step ?? latest.currentStep,
      saved: false,
    };
  }

  let saved = false;
  try {
    saved = await saveSection(plan.patch);
  } catch {
    saved = false;
  }
  if (!isCurrent()) return null;
  if (!saved) {
    return {
      reply: SAVED_QUEST_HELPER_SAVE_FAILED,
      pending: latest.pending,
      focusStep: latest.pending?.step ?? latest.currentStep,
      saved: false,
    };
  }
  return {
    reply: savedQuestSectionReply(plan.patch),
    pending: null,
    focusStep: settled.focusStep,
    saved: true,
  };
}
