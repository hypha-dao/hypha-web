import {
  QUEST_STEWARD_STEPS,
  bulletsToMarkdownList,
  questEditRequestSection,
  splitMarkdownLinesToBullets,
  type QuestStewardStep,
  type schemaPatchSpaceQuest,
} from '@hypha-platform/core/client';
import type { z } from 'zod';
import type { QuestSpaceMember } from '../hooks/use-space-quests';
import {
  QUEST_DRAFT_READY_REPLY,
  QUEST_EDIT_NOT_FILED_REPLY,
  formatPendingQuestPatch,
  questSectionApprovalQuestion,
  questStepSectionLabel,
  replyWithoutUnbackedEditClaim,
  settleCreateDraftTurn,
  stewardQuestionForStep,
  type PendingQuestSectionProposal,
  type QuestDraftModelTurn,
  type QuestDraftPatchInput,
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
 * Former opening line. Saved-quest discussions no longer post it.
 * Kept so a stored thread from an older tab can drop that greeting.
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

type ScopeSide = 'in' | 'out' | 'both';

function scopeSide(message: string): ScopeSide | null {
  const inNamed = /\b(?:scope\s+in|in[-\s]?scope)\b/i.test(message);
  const outNamed = /\b(?:scope\s+out|out[-\s]of[-\s]?scope)\b/i.test(message);
  if (inNamed && outNamed) return 'both';
  if (outNamed) return 'out';
  if (inNamed) return 'in';
  return null;
}

/** Add/include, and a single "Scope In:" line, keep the items already stored. */
function appendsScopeList(message: string): boolean {
  if (
    /\b(?:replace|chang(?:e|ing)|set(?:ting)?|updat(?:e|ing)|rewrite|remov(?:e|ing)|drop(?:ping)?)\b/i.test(
      message,
    )
  ) {
    return false;
  }
  if (
    /\b(?:add(?:ing)?|includ(?:e|ing)|append(?:ing)?|insert(?:ing)?|propos(?:e|ing)|suggest(?:ing)?)\b/i.test(
      message,
    )
  ) {
    return true;
  }
  return /^\s*(?:scope\s+in|scope\s+out|in\s+scope|out\s+of\s+scope)\s*:/i.test(
    message,
  );
}

function quotedScopeItem(message: string): string | null {
  const quoted = /["“]([^"”]+)["”]/.exec(message)?.[1]?.trim();
  return quoted || null;
}

function labeledScopeItem(message: string, side: 'in' | 'out'): string | null {
  const pattern =
    side === 'in'
      ? /(?:^|\n)\s*(?:scope\s+in|in\s+scope)\s*:\s*(.+)$/i
      : /(?:^|\n)\s*(?:scope\s+out|out\s+of\s+scope)\s*:\s*(.+)$/i;
  const value = pattern.exec(message.trim())?.[1]?.trim();
  if (!value) return null;
  return quotedScopeItem(value) ?? value;
}

function cleanAddedItem(item: string, message: string): string {
  const trimmed = item.trim();
  if (!trimmed) return '';
  if (message.includes(trimmed)) return trimmed;
  const withoutPeriod = trimmed.replace(/\.+$/, '').trim();
  if (withoutPeriod && message.includes(withoutPeriod)) return withoutPeriod;
  return trimmed;
}

function mergeScopeItems(
  existing: readonly string[],
  incoming: readonly string[],
  message: string,
): string[] {
  const seen = new Set(
    existing.map((item) => item.trim().toLowerCase()).filter(Boolean),
  );
  const next = existing.map((item) => item.trim()).filter(Boolean);
  for (const raw of incoming) {
    const item = cleanAddedItem(raw, message);
    const key = item.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    next.push(item);
  }
  return next;
}

/**
 * An add/include on a saved quest appends. The patch is the list the card
 * shows, including the items that were already there.
 */
export function savedScopeAppendPatch(
  draft: QuestDraftStateSnapshot,
  message: string,
  patch: QuestDraftPatchInput | null,
): QuestDraftPatchInput | null {
  if (!appendsScopeList(message)) return null;
  const side = scopeSide(message);
  if (!side) return null;
  const next: QuestDraftPatchInput = {};
  if (side !== 'out') {
    const labeled = labeledScopeItem(message, 'in');
    const quoted = side === 'in' ? quotedScopeItem(message) : null;
    const incoming = [
      ...(patch?.scopeIn ?? []),
      ...(labeled ? [labeled] : []),
      ...(quoted ? [quoted] : []),
    ];
    if (incoming.length > 0) {
      next.scopeIn = mergeScopeItems(draft.scopeIn, incoming, message);
    }
  }
  if (side !== 'in') {
    const labeled = labeledScopeItem(message, 'out');
    const quoted = side === 'out' ? quotedScopeItem(message) : null;
    const incoming = [
      ...(patch?.scopeOut ?? []),
      ...(labeled ? [labeled] : []),
      ...(quoted ? [quoted] : []),
    ];
    if (incoming.length > 0) {
      next.scopeOut = mergeScopeItems(draft.scopeOut, incoming, message);
    }
  }
  const inChanged =
    next.scopeIn != null &&
    (next.scopeIn.length !== draft.scopeIn.length ||
      next.scopeIn.some((item, index) => item !== draft.scopeIn[index]));
  const outChanged =
    next.scopeOut != null &&
    (next.scopeOut.length !== draft.scopeOut.length ||
      next.scopeOut.some((item, index) => item !== draft.scopeOut[index]));
  if (!inChanged && !outChanged) return null;
  return next;
}

function savedPendingCard(pending: PendingQuestSectionProposal): string {
  const preview = formatPendingQuestPatch(pending.patch).trim();
  const question = questSectionApprovalQuestion(pending.step);
  return [preview, 'Not saved yet.', question].filter(Boolean).join('\n\n');
}

function withoutCreateFlowQuestions(reply: string, message: string): string {
  const requested = questEditRequestSection(message);
  const about = requested ? questStepSectionLabel(requested) : '';
  const prompts = QUEST_STEWARD_STEPS.map((step) =>
    stewardQuestionForStep(step),
  );
  const pieces = reply.split(/(\n+|(?<=[.!?])\s+)/);
  let kept = '';
  for (let index = 0; index < pieces.length; index += 2) {
    const sentence = pieces[index] ?? '';
    const separator = pieces[index + 1] ?? '';
    const text = sentence.trim();
    if (!text) continue;
    if (
      text === QUEST_DRAFT_READY_REPLY ||
      text.includes('CREATE QUEST') ||
      text.includes('CREATE PROPOSAL')
    ) {
      continue;
    }
    if (prompts.some((prompt) => text.includes(prompt))) continue;
    if (
      text.includes('?') &&
      about &&
      !new RegExp(about.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i').test(text)
    ) {
      continue;
    }
    kept += sentence + separator;
  }
  return kept.replace(/\n{3,}/g, '\n\n').trim();
}

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
    patch?: QuestDraftPatchInput;
  };
}) {
  return {
    message,
    helperMode: 'saved' as const,
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
    const appended = savedScopeAppendPatch(
      latest.draft,
      message,
      settled.pending?.patch ?? null,
    );
    if (appended) {
      const pending: PendingQuestSectionProposal = {
        step: 'scope',
        patch: appended,
      };
      return {
        reply: savedPendingCard(pending),
        pending,
        focusStep: 'scope',
        saved: false,
      };
    }
    const pending = settled.pending;
    let reply = pending
      ? alignSavedListReply(
          savedPendingCard(pending),
          latest.draft,
          message,
          pending.step,
        )
      : withoutCreateFlowQuestions(
          questEditRequestSection(message)
            ? replyWithoutUnbackedEditClaim(settled.reply) ||
                QUEST_EDIT_NOT_FILED_REPLY
            : settled.reply,
          message,
        );
    if (!reply.trim()) {
      reply = questEditRequestSection(message)
        ? QUEST_EDIT_NOT_FILED_REPLY
        : 'Tell me one section to change.';
    }
    return {
      reply,
      pending,
      focusStep: pending?.step ?? settled.focusStep,
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
