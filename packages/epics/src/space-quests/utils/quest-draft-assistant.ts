import {
  QUEST_STEWARD_STEPS,
  bulletsToMarkdownList,
  limitQuestPatchToStep,
  splitMarkdownLinesToBullets,
  stripViewerYouMarker,
  type QuestReward,
  type QuestStewardStep,
} from '@hypha-platform/core/client';
import type {
  EditableQuestMember,
  EditableQuestMilestone,
} from '../components/quest-section-edit-modals';
import type { QuestSpaceMember } from '../hooks/use-space-quests';

function matchQuestMemberByName(
  members: readonly QuestSpaceMember[],
  rawName: string | null | undefined,
): QuestSpaceMember | null {
  const clean = rawName
    ? stripViewerYouMarker(rawName).trim().toLowerCase()
    : '';
  if (!clean) return null;
  return (
    members.find(
      (m) =>
        m.name.toLowerCase() === clean ||
        (m.nickname && m.nickname.trim().toLowerCase() === clean),
    ) ?? null
  );
}

export type QuestDraftStateSnapshot = {
  name: string;
  goal: string;
  scopeIn: string[];
  scopeOut: string[];
  scopeInMarkdown: string;
  scopeOutMarkdown: string;
  successCriteria: string;
  rewards: QuestReward[];
  milestones: EditableQuestMilestone[];
  leadName: string;
  selectedLeadPersonId: number | null;
  members: EditableQuestMember[];
  targetDate: string | null;
};

export type QuestDraftPatchInput = {
  name?: string;
  goal?: string;
  scopeIn?: string[];
  scopeOut?: string[];
  successCriteriaBullets?: string[];
  targetDate?: string;
  leadName?: string;
  rewards?: Array<{ amount: string; token: string }>;
  milestones?: Array<{
    name: string;
    dueDate?: string;
    description?: string;
    ownerName?: string;
  }>;
  members?: Array<{
    memberName: string;
    roleLabel?: string;
    responsibilities?: string[];
  }>;
};

export function stewardQuestionForStep(step: QuestStewardStep): string {
  switch (step) {
    case 'goal':
      return 'Hey, what is the goal of the quest you want to create?';
    case 'scope':
      return "What's in scope, and what's explicitly out of scope?";
    case 'success':
      return 'How will we know this quest succeeded? Share the key measurable outcomes.';
    case 'milestones':
      return "Let's break it into milestones — what are the key checkpoints, target dates, and owners?";
    case 'members':
      return "Who's on the quest, and what concrete outcomes is each person responsible for?";
    case 'lead':
      return 'Who should lead this quest?';
    case 'targetDate':
      return "What's the overall target completion date?";
    case 'rewards':
      return 'What Quest Reward tokens and amounts should be included (e.g. 2,500 USDC + 0.4 ETH)?';
    case 'name':
      return 'Finally, what should we name this quest?';
  }
}

function formatFutureDateLabel(daysFromNow: number): string {
  const target = new Date(Date.now() + daysFromNow * 86_400_000);
  return target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function splitListItems(raw: string): string[] {
  const fromLines = splitMarkdownLinesToBullets(raw);
  if (fromLines.length > 1) return fromLines;
  const single = fromLines[0] ?? raw.trim();
  if (!single) return [];
  if (single.includes(';')) {
    return single
      .split(';')
      .map((s) => s.replace(/^[-*•\d.)\s]+/, '').trim())
      .filter(Boolean);
  }
  if (single.split(',').length >= 3) {
    return single
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [single];
}

function extractRewardsFromText(text: string): QuestReward[] {
  const matches = Array.from(
    text.matchAll(
      /\b(\d[\d,.]*)\s*(USDC|USDT|ETH|HYPHA|DAI|EURC|WBTC|OP|BASE)\b/gi,
    ),
  );
  if (matches.length > 0) {
    return matches.map((m) => ({
      amount: m[1]!.replace(/,/g, ''),
      token: m[2]!.toUpperCase(),
    }));
  }
  const generic = Array.from(text.matchAll(/\b(\d[\d,.]*)\s+([A-Z]{2,10})\b/g));
  return generic.map((m) => ({
    amount: m[1]!.replace(/,/g, ''),
    token: m[2]!.toUpperCase(),
  }));
}

/** Asks to invent several sections at once. The coach answers the active section only. */
function isBulkSectionDraftRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const asksToDraft =
    /\b(draft|suggest|propose|auto[- ]?fill|fill (?:in|out)|generate)\b/.test(
      lower,
    );
  if (!asksToDraft) return false;
  if (/\b(sections|everything|all of it|the rest)\b/.test(lower)) return true;
  const mentionsScope = /\bscope\b/.test(lower);
  const mentionsSuccess = /\b(success|criteria)\b/.test(lower);
  const mentionsMilestones = /\bmilestones?\b/.test(lower);
  return (
    [mentionsScope, mentionsSuccess, mentionsMilestones].filter(Boolean)
      .length >= 2
  );
}

function stepFieldsAlreadyCaptured(
  patch: QuestDraftPatchInput,
  step: QuestStewardStep,
): boolean {
  switch (step) {
    case 'goal':
      return Boolean(patch.goal?.trim());
    case 'scope':
      return Boolean(patch.scopeIn?.length || patch.scopeOut?.length);
    case 'success':
      return Boolean(patch.successCriteriaBullets?.length);
    case 'milestones':
      return Boolean(patch.milestones?.length);
    case 'members':
      return Boolean(patch.members?.length);
    case 'lead':
      return Boolean(patch.leadName?.trim());
    case 'targetDate':
      return Boolean(patch.targetDate?.trim());
    case 'rewards':
      return Boolean(patch.rewards?.length);
    case 'name':
      return Boolean(patch.name?.trim());
  }
}

const QUEST_STEP_LABEL: Record<QuestStewardStep, string> = {
  goal: 'Goal',
  scope: 'Scope',
  success: 'Success criteria',
  milestones: 'Milestones',
  members: 'Members',
  lead: 'Lead',
  targetDate: 'Target date',
  rewards: 'Quest Reward',
  name: 'Name',
};

export function questStepSectionLabel(step: QuestStewardStep): string {
  return QUEST_STEP_LABEL[step];
}

/**
 * Extract the active section from a user message.
 * A goal answer does not also invent scope, milestones, rewards, or a name.
 */
export function buildLocalQuestDraftPatch({
  message,
  currentStep,
  viewerDisplayName,
}: {
  message: string;
  currentStep: QuestStewardStep;
  draft: QuestDraftStateSnapshot;
  viewerDisplayName: string;
}): QuestDraftPatchInput {
  const trimmed = message.trim();
  if (!trimmed) return {};
  if (isBulkSectionDraftRequest(trimmed)) return {};

  const patch: QuestDraftPatchInput = {};

  // Check for explicit labeled sections in a multi-part message
  const goalMatch =
    /(?:^|\n|\b)goal\s*:\s*([^\n]+(?:\n(?!\w+\s*:)[^\n]+)*)/i.exec(trimmed);
  const inScopeMatch =
    /(?:^|\n|\b)(?:in\s*scope|scope\s*in|in)\s*:\s*([^\n]+(?:\n(?!\w+\s*:)[^\n]+)*)/i.exec(
      trimmed,
    );
  const outScopeMatch =
    /(?:^|\n|\b)(?:out\s*of\s*scope|scope\s*out|out)\s*:\s*([^\n]+(?:\n(?!\w+\s*:)[^\n]+)*)/i.exec(
      trimmed,
    );
  const successMatch =
    /(?:^|\n|\b)success(?:\s*criteria)?\s*:\s*([^\n]+(?:\n(?!\w+\s*:)[^\n]+)*)/i.exec(
      trimmed,
    );
  const nameMatch =
    /(?:^|\n|\b)(?:quest\s*name|name|title)\s*:\s*([^\n]+)/i.exec(trimmed);
  const leadMatch = /(?:^|\n|\b)lead\s*:\s*([^\n]+)/i.exec(trimmed);
  const targetMatch = /(?:^|\n|\b)target(?:\s*date)?\s*:\s*([^\n]+)/i.exec(
    trimmed,
  );

  if (goalMatch?.[1]) patch.goal = goalMatch[1].trim();
  if (inScopeMatch?.[1]) patch.scopeIn = splitListItems(inScopeMatch[1]);
  if (outScopeMatch?.[1]) patch.scopeOut = splitListItems(outScopeMatch[1]);
  if (successMatch?.[1]) {
    patch.successCriteriaBullets = splitListItems(successMatch[1]);
  }
  if (nameMatch?.[1]) patch.name = nameMatch[1].trim();
  if (leadMatch?.[1]) patch.leadName = leadMatch[1].trim();
  if (targetMatch?.[1]) patch.targetDate = targetMatch[1].trim();

  const extractedRewards = extractRewardsFromText(trimmed);
  if (
    extractedRewards.length > 0 &&
    (currentStep === 'rewards' || /reward/i.test(trimmed))
  ) {
    patch.rewards = extractedRewards;
  }

  if (!stepFieldsAlreadyCaptured(patch, currentStep)) {
    if (currentStep === 'goal') {
      patch.goal = trimmed;
    } else if (currentStep === 'scope') {
      const parts = trimmed.split(/\bout(?:\s+of\s+scope)?\s*:/i);
      const inItems = splitListItems(
        (parts[0] ?? trimmed).replace(/^(?:in(?:\s+scope)?)\s*:/i, ''),
      );
      const outItems = parts[1] ? splitListItems(parts[1]) : [];
      if (inItems.length > 0) patch.scopeIn = inItems;
      if (outItems.length > 0) patch.scopeOut = outItems;
    } else if (currentStep === 'success') {
      const bullets = splitListItems(trimmed);
      patch.successCriteriaBullets = bullets.length > 0 ? bullets : [trimmed];
    } else if (currentStep === 'milestones') {
      const segments = trimmed
        .split(/\n|;|\b(?=M\d+\b)/i)
        .map((s) => s.replace(/^(?:M\d+|[-*•]|\d+\.)\s*[:·-]?\s*/i, '').trim())
        .filter(Boolean);
      const items = segments.length > 0 ? segments : [trimmed];
      patch.milestones = items.map((seg, idx) => {
        const dateMatch =
          /\b(?:by|due|on)\s+([A-Z][a-z]{2,8}\s+\d{1,2}(?:,\s*\d{4})?|\d{4}-\d{2}-\d{2})\b/i.exec(
            seg,
          );
        const cleanSeg = dateMatch ? seg.replace(dateMatch[0], '').trim() : seg;
        const parts = cleanSeg.split(/\s+[—–-]\s+|\s*:\s*/);
        const mName = (parts[0] || cleanSeg).slice(0, 80).trim();
        const mDesc = parts.slice(1).join(' — ').trim() || cleanSeg;
        return {
          name: mName || `Milestone ${idx + 1}`,
          dueDate: dateMatch?.[1] ?? formatFutureDateLabel((idx + 1) * 7),
          description: mDesc,
          ownerName: viewerDisplayName,
        };
      });
    } else if (currentStep === 'members') {
      const entries = trimmed
        .split(/\n|;/)
        .map((s) => s.trim())
        .filter(Boolean);
      patch.members = entries.map((entry) => {
        const [rawPerson, ...rest] = entry.split(':');
        const memberName =
          rawPerson?.replace(/^@/, '').replace(/_/g, ' ').trim() ||
          entry.slice(0, 32);
        const respText = rest.join(':').trim();
        const responsibilities = respText
          ? splitListItems(respText)
          : ['Core outcome delivery'];
        return {
          memberName,
          roleLabel: 'Member',
          responsibilities,
        };
      });
    } else if (currentStep === 'lead') {
      patch.leadName = trimmed.replace(/^@/, '').replace(/_/g, ' ').trim();
    } else if (currentStep === 'targetDate') {
      patch.targetDate = trimmed;
    } else if (currentStep === 'rewards') {
      if (extractedRewards.length > 0) {
        patch.rewards = extractedRewards;
      } else {
        const numMatch = /(\d[\d,.]*)/.exec(trimmed);
        if (numMatch?.[1]) {
          patch.rewards = [
            { amount: numMatch[1].replace(/,/g, ''), token: 'USDC' },
          ];
        }
      }
    } else if (currentStep === 'name') {
      patch.name = trimmed.replace(/^["']|["']$/g, '').trim();
    }
  }

  return limitQuestPatchToStep(patch, currentStep);
}

export function applyPatchToQuestDraftState({
  current,
  patch,
  spaceMembers,
  viewerDisplayName,
}: {
  current: QuestDraftStateSnapshot;
  patch: QuestDraftPatchInput;
  spaceMembers: readonly QuestSpaceMember[];
  viewerDisplayName: string;
}): {
  next: QuestDraftStateSnapshot;
  updatedLabels: string[];
} {
  const next: QuestDraftStateSnapshot = { ...current };
  const updatedLabels: string[] = [];

  if (patch.goal?.trim()) {
    next.goal = patch.goal.trim();
    updatedLabels.push('Goal');
  }

  if (
    (patch.scopeIn && patch.scopeIn.length > 0) ||
    (patch.scopeOut && patch.scopeOut.length > 0)
  ) {
    if (patch.scopeIn && patch.scopeIn.length > 0) {
      next.scopeIn = patch.scopeIn;
      next.scopeInMarkdown = bulletsToMarkdownList(patch.scopeIn);
    }
    if (patch.scopeOut && patch.scopeOut.length > 0) {
      next.scopeOut = patch.scopeOut;
      next.scopeOutMarkdown = bulletsToMarkdownList(patch.scopeOut);
    }
    updatedLabels.push('Scope');
  }

  if (patch.successCriteriaBullets && patch.successCriteriaBullets.length > 0) {
    next.successCriteria = bulletsToMarkdownList(patch.successCriteriaBullets);
    updatedLabels.push('Success criteria');
  }

  if (patch.milestones && patch.milestones.length > 0) {
    next.milestones = patch.milestones.map((m) => {
      const matchedOwner = m.ownerName
        ? matchQuestMemberByName(spaceMembers, m.ownerName)
        : null;
      return {
        name: m.name.trim(),
        dueDate: m.dueDate?.trim() || null,
        description: m.description?.trim() || m.name.trim(),
        ownerPersonId: matchedOwner?.personId ?? null,
        ownerName:
          matchedOwner?.name ?? m.ownerName?.trim() ?? viewerDisplayName,
        status: 'not_started',
      };
    });
    updatedLabels.push('Milestones');
  }

  if (patch.members && patch.members.length > 0) {
    const mapped = patch.members.map((m): EditableQuestMember => {
      const matched = matchQuestMemberByName(spaceMembers, m.memberName);
      return {
        personId: matched?.personId ?? null,
        memberName: matched?.name || m.memberName.trim(),
        memberAvatarUrl: matched?.avatarUrl ?? null,
        roleLabel: m.roleLabel?.trim() || 'Member',
        responsibilities:
          m.responsibilities && m.responsibilities.length > 0
            ? m.responsibilities
            : ['Core outcome delivery'],
      };
    });
    const byName = new Map<string, EditableQuestMember>();
    for (const existing of next.members) {
      byName.set(existing.memberName.toLowerCase(), existing);
    }
    for (const item of mapped) {
      byName.set(item.memberName.toLowerCase(), item);
    }
    next.members = [...byName.values()];
    updatedLabels.push('Members');
  }

  if (patch.leadName?.trim()) {
    const rawLead = stripViewerYouMarker(patch.leadName).trim();
    const matchedLead = matchQuestMemberByName(spaceMembers, rawLead);
    next.leadName = matchedLead?.name || rawLead;
    next.selectedLeadPersonId = matchedLead?.personId ?? null;
    updatedLabels.push('Lead');
  }

  if (patch.targetDate?.trim()) {
    next.targetDate = patch.targetDate.trim();
    updatedLabels.push('Target date');
  }

  if (patch.rewards && patch.rewards.length > 0) {
    const byToken = new Map<string, QuestReward>();
    for (const existing of next.rewards) {
      if (existing.amount.trim() && existing.token.trim()) {
        byToken.set(existing.token.toUpperCase(), existing);
      }
    }
    for (const item of patch.rewards) {
      if (item.amount.trim() && item.token.trim()) {
        byToken.set(item.token.toUpperCase(), {
          amount: item.amount.trim(),
          token: item.token.toUpperCase(),
        });
      }
    }
    next.rewards = [...byToken.values()];
    updatedLabels.push('Quest Reward');
  }

  if (patch.name?.trim()) {
    next.name = patch.name.trim();
    updatedLabels.push('Name');
  }

  return { next, updatedLabels };
}

export function findNextUnfilledQuestStep(
  draft: QuestDraftStateSnapshot,
  afterStep?: QuestStewardStep,
): QuestStewardStep | null {
  const isFilled = (step: QuestStewardStep): boolean => {
    switch (step) {
      case 'goal':
        return Boolean(draft.goal.trim());
      case 'scope':
        return draft.scopeIn.length > 0 || draft.scopeOut.length > 0;
      case 'success':
        return splitMarkdownLinesToBullets(draft.successCriteria).length > 0;
      case 'milestones':
        return draft.milestones.length > 0;
      case 'members':
        return draft.members.length > 0;
      case 'lead':
        return Boolean(draft.leadName.trim());
      case 'targetDate':
        return Boolean(draft.targetDate?.trim());
      case 'rewards':
        return draft.rewards.length > 0;
      case 'name':
        return Boolean(draft.name.trim());
    }
  };

  const startIdx = afterStep
    ? Math.max(0, QUEST_STEWARD_STEPS.indexOf(afterStep) + 1)
    : 0;
  for (let i = startIdx; i < QUEST_STEWARD_STEPS.length; i += 1) {
    const candidate = QUEST_STEWARD_STEPS[i]!;
    if (!isFilled(candidate)) return candidate;
  }
  for (const candidate of QUEST_STEWARD_STEPS) {
    if (!isFilled(candidate)) return candidate;
  }
  return null;
}

/** Stay on the current section until that section itself was written. */
export function nextQuestStepAfterUpdate({
  draft,
  currentStep,
  updatedLabels,
}: {
  draft: QuestDraftStateSnapshot;
  currentStep: QuestStewardStep;
  updatedLabels: readonly string[];
}): { step: QuestStewardStep; complete: boolean } {
  if (!updatedLabels.includes(QUEST_STEP_LABEL[currentStep])) {
    return { step: currentStep, complete: false };
  }
  const next = findNextUnfilledQuestStep(draft, currentStep);
  if (!next) return { step: currentStep, complete: true };
  return { step: next, complete: false };
}
