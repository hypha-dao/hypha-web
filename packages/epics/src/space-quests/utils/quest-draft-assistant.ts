import {
  QUEST_STEWARD_STEPS,
  bulletsToMarkdownList,
  isBulkQuestDraftRequest,
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
  return isBulkQuestDraftRequest(text);
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

const SECTION_APPROVAL =
  /^(yes|yeah|yep|yup|ok|okay|sure|approved|i approve|include that|include it|put that in(?: the)?(?: [\w\s]{0,32})?|put it in(?: the)?(?: [\w\s]{0,32})?|use that|use it|looks good|go ahead|add it|apply it|that(?:'s| is) good|perfect|do it|sounds good)[.!]?(?:\s+please)?$/i;

const SECTION_REWRITE =
  /\b(improve|evaluate|rewrite|reword|tighten|revise|suggest(?:\s+\w+){0,3}\s+(?:wording|copy|text)|make (?:this|it|that) (?:sharper|clearer|shorter|better))\b/i;

const SECTION_OPENER =
  /\b(?:let'?s|let us|now)\b.{0,48}\b(?:define|talk about|work on|move on|start|cover)\b|\b(?:define|talk about|work on|move on to|start on|cover)\s+(?:the\s+)?(success\s+criteria|in[-\s]?scope|out[-\s]of[-\s]?scope|milestones?|members?|target\s+date|quest\s+rewards?|rewards?|quest\s+name|scope|success|lead|goal|name|title)\b|\b(what is|what['\u2019]s|how (?:do|should) (?:i|we)|help me (?:think|understand)|explain)\b/i;

/** "yes", "include that", "put that in Scope", "I approve". Not a long answer that happens to start with yes. */
export function isQuestSectionApproval(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 96) return false;
  if (/\b(but|except|instead|rather|change|don't|do not)\b/i.test(text)) {
    return false;
  }
  if (SECTION_REWRITE.test(text)) return false;
  return SECTION_APPROVAL.test(text);
}

export function isQuestSectionRewriteRequest(message: string): boolean {
  return SECTION_REWRITE.test(message);
}

/** Opening a section to think it through. Not a request to paste wording. */
export function isQuestSectionCoachingOpener(message: string): boolean {
  const text = message.trim();
  if (!text || text.length > 220) return false;
  if (isQuestSectionApproval(text) || isQuestSectionRewriteRequest(text)) {
    return false;
  }
  if (isBulkQuestDraftRequest(text)) return false;
  if (/:\s*\S/.test(text) && text.length > 48) return false;
  return SECTION_OPENER.test(text);
}

export function messageSuppliesSectionContent(message: string): boolean {
  const text = message.trim();
  if (!text) return false;
  if (isBulkQuestDraftRequest(text)) return false;
  if (isQuestSectionApproval(text)) return false;
  if (isQuestSectionCoachingOpener(text)) return false;
  if (isQuestSectionRewriteRequest(text) && text.length < 100) return false;
  return true;
}

export function questSectionApprovalQuestion(step: QuestStewardStep): string {
  return `Do you want that to be in the ${QUEST_STEP_LABEL[step]}?`;
}

/** Teach the section. No wording to paste. */
export function questSectionCoachReply(step: QuestStewardStep): string {
  switch (step) {
    case 'goal':
      return 'The goal is why this quest exists now: who it is for, and the concrete change it delivers. A vague verb like "improve" or "explore" needs a deliverable or a check you can point at. Who benefits, and what will be different when this quest is done?';
    case 'scope':
      return 'Scope is the boundary of the quest, not a restatement of the goal. In-scope is the work this quest will actually ship. Out-of-scope is the nearby work you are leaving out, so voters know where it stops. What is the one thing this quest must deliver, and what should stay out?';
    case 'success':
      return 'Success criteria are how you will know the quest worked, not a list of tasks. A good check is something a reviewer can verify: a number, a recorded pass, or a shipped artifact. What would you look at to say this is done?';
    case 'milestones':
      return 'Milestones are ordered checkpoints on the way to that outcome. Each one needs an owner and a date, and each should make the next step possible. What is the first checkpoint, and who owns it?';
    case 'members':
      return 'Members are people from this space who own an outcome, not a job title. Each person should have one or two responsibilities you could check. Who needs to be on this quest, and what do they own?';
    case 'lead':
      return 'The lead is the one space member accountable for the quest as a whole. Who should carry that?';
    case 'targetDate':
      return 'The target date is when the outcome should be real, not when the first milestone lands. What date should voters hold the quest to?';
    case 'rewards':
      return 'Quest Reward is the token amount the space is agreeing to pay for this outcome, such as 2,500 USDC. What amount and token should be in the proposal?';
    case 'name':
      return 'The name is the short title voters will see on the proposal, usually two to six words. What should this quest be called?';
  }
}

export type PendingQuestSectionProposal = {
  step: QuestStewardStep;
  patch: QuestDraftPatchInput;
};

export type NewQuestDraftTurn =
  | { kind: 'bulk'; step: QuestStewardStep }
  | { kind: 'coach'; step: QuestStewardStep }
  | {
      kind: 'apply';
      step: QuestStewardStep;
      patch: QuestDraftPatchInput;
    }
  | { kind: 'propose'; step: QuestStewardStep };

function sectionNamedInApproval(message: string): QuestStewardStep | null {
  const named =
    /\b(?:in|into|for|to)\s+(?:the\s+)?(success\s+criteria|milestones?|members?|target\s+date|rewards?|scope|success|lead|goal|name|title)\b/i.exec(
      message,
    );
  if (!named?.[1]) return null;
  const raw = named[1].toLowerCase();
  if (raw.includes('scope')) return 'scope';
  if (raw.includes('success')) return 'success';
  if (raw.includes('milestone')) return 'milestones';
  if (raw.includes('member')) return 'members';
  if (raw.includes('target')) return 'targetDate';
  if (raw.includes('reward')) return 'rewards';
  if (raw.includes('name') || raw.includes('title')) return 'name';
  if (raw === 'lead') return 'lead';
  if (raw.includes('goal')) return 'goal';
  return null;
}

/**
 * New-quest chat never writes a section until the member approves.
 * Opening a section only coaches. A proposal stays in chat until yes.
 */
export function decideNewQuestDraftTurn({
  message,
  currentStep,
  targetStep,
  bulk,
  pending,
}: {
  message: string;
  currentStep: QuestStewardStep;
  targetStep: QuestStewardStep;
  bulk: boolean;
  pending: PendingQuestSectionProposal | null;
}): NewQuestDraftTurn {
  if (bulk) return { kind: 'bulk', step: currentStep };
  if (isQuestSectionApproval(message)) {
    const named = sectionNamedInApproval(message);
    const pendingPatch = pending?.patch ?? {};
    const hasPending = Object.keys(pendingPatch).length > 0;
    if (pending && hasPending && (!named || named === pending.step)) {
      return { kind: 'apply', step: pending.step, patch: pending.patch };
    }
    return { kind: 'coach', step: named ?? targetStep };
  }
  if (isQuestSectionCoachingOpener(message)) {
    return { kind: 'coach', step: targetStep };
  }
  return { kind: 'propose', step: targetStep };
}

export function formatPendingQuestPatch(patch: QuestDraftPatchInput): string {
  const lines: string[] = [];
  if (patch.name?.trim()) lines.push(patch.name.trim());
  if (patch.goal?.trim()) lines.push(patch.goal.trim());
  if (patch.scopeIn && patch.scopeIn.length > 0) {
    lines.push(`In:\n${bulletsToMarkdownList(patch.scopeIn)}`);
  }
  if (patch.scopeOut && patch.scopeOut.length > 0) {
    lines.push(`Out:\n${bulletsToMarkdownList(patch.scopeOut)}`);
  }
  if (patch.successCriteriaBullets && patch.successCriteriaBullets.length > 0) {
    lines.push(bulletsToMarkdownList(patch.successCriteriaBullets));
  }
  if (patch.milestones && patch.milestones.length > 0) {
    lines.push(
      patch.milestones
        .map((milestone, index) => {
          const when = milestone.dueDate?.trim();
          const owner = milestone.ownerName?.trim();
          const detail = [when, owner].filter(Boolean).join(' · ');
          return `M${index + 1} · ${milestone.name.trim()}${
            detail ? ` (${detail})` : ''
          }`;
        })
        .join('\n'),
    );
  }
  if (patch.members && patch.members.length > 0) {
    lines.push(
      patch.members
        .map((member) => {
          const duties = (member.responsibilities ?? []).filter(Boolean);
          return duties.length > 0
            ? `${member.memberName}: ${duties.join('; ')}`
            : member.memberName;
        })
        .join('\n'),
    );
  }
  if (patch.leadName?.trim()) lines.push(patch.leadName.trim());
  if (patch.targetDate?.trim()) lines.push(patch.targetDate.trim());
  if (patch.rewards && patch.rewards.length > 0) {
    lines.push(
      patch.rewards
        .map((reward) => `${reward.amount} ${reward.token}`)
        .join(', '),
    );
  }
  return lines.join('\n\n');
}

export function replyWithSectionApprovalAsk(
  reply: string | null | undefined,
  step: QuestStewardStep,
  patch: QuestDraftPatchInput,
): string {
  const question = questSectionApprovalQuestion(step);
  const model = reply?.trim() ?? '';
  if (/do you want that to be in the/i.test(model)) return model;
  const preview = formatPendingQuestPatch(patch).trim();
  if (model) return `${model}\n\n${question}`;
  if (preview) return `${preview}\n\n${question}`;
  return question;
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
