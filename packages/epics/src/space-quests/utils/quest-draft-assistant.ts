import {
  QUEST_STEWARD_STEPS,
  bulletsToMarkdownList,
  isBulkQuestDraftRequest,
  limitQuestPatchToStep,
  resolveQuestDraftTarget,
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

function splitListItems(raw: string): string[] {
  const fromLines = splitMarkdownLinesToBullets(raw);
  if (fromLines.length > 1) return fromLines;
  const single = fromLines[0] ?? raw.trim();
  if (!single) return [];
  if (single.includes(';')) {
    return single
      .split(';')
      .map((s) =>
        s
          .trim()
          .replace(/^(?:[-*•]|\d+[.)])\s+/, '')
          .trim(),
      )
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

const APPROVAL_SECTION =
  '(?:success\\s+criteria|milestones?|members?|target\\s+date|quest\\s+rewards?|rewards?|scope|success|lead|goal|name|title)';

const APPROVAL_PHRASE = `(?:yeah|yep|yup|okay|yes|ok|sure|approved|i approve|include that|include it|put that in(?: the)?(?:\\s+${APPROVAL_SECTION})?|put it in(?: the)?(?:\\s+${APPROVAL_SECTION})?|use that|use it|looks good|go ahead|add it|apply it|that(?:'s| is) good|perfect|do it|sounds good)`;

/** Tester lines that must never be proposed or written into a section. */
const QUEST_META_INSTRUCTION =
  /(?:^|[\s.])please\s+(?:write|propose|rewrite|include|put|draft|use)\b(?:(?![.!\n]).){0,240}?\bin chat first\b[^.!\n]*[.!?]?/gi;

const SECTION_REWRITE =
  /\b(improve|evaluate|rewrite|reword|tighten|revise|suggest(?:\s+\w+){0,3}\s+(?:wording|copy|text)|make (?:this|it|that) (?:sharper|clearer|shorter|better))\b/i;

const SECTION_OPENER =
  /\b(?:let'?s|let us|now)\b.{0,48}\b(?:define|talk about|work on|move on|start|cover)\b|\b(?:define|talk about|work on|move on to|start on|cover)\s+(?:the\s+)?(success\s+criteria|in[-\s]?scope|out[-\s]of[-\s]?scope|milestones?|members?|target\s+date|quest\s+rewards?|rewards?|quest\s+name|scope|success|lead|goal|name|title)\b|\b(what is|what['\u2019]s|how (?:do|should) (?:i|we)|help me (?:think|understand)|explain)\b/i;

function approvalRemainder(rest: string): boolean {
  const text = rest
    .trim()
    .replace(/[.!]+$/g, '')
    .trim();
  if (!text) return true;
  return new RegExp(`^(?:please|${APPROVAL_PHRASE})$`, 'i').test(text);
}

/**
 * "yes", "yes please", "Yes, put that in the Goal.", "include that", "I approve".
 * A longer answer that only starts with yes is still content.
 */
export function isQuestSectionApproval(message: string): boolean {
  const text = message
    .trim()
    .replace(/[.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length > 120) return false;
  if (/\b(but|except|instead|rather|change|don't|do not)\b/i.test(text)) {
    return false;
  }
  if (SECTION_REWRITE.test(text)) return false;
  const match = new RegExp(
    `^(${APPROVAL_PHRASE})(?:\\s*,)?(?:\\s+please)?(?:\\s*,\\s*|\\s+)?(.*)$`,
    'i',
  ).exec(text);
  if (!match) return false;
  return approvalRemainder(match[2] ?? '');
}

const REJECTION_PHRASE =
  /^(?:no|nope|nah|don't|do not|not that|no thanks|no thank you|reject(?: that)?|skip that)(?:[.!])?$/i;

/** A question or coaching request, including one that names a section mid-sentence. */
const QUESTION_OPENING =
  /^(?:do you|does this|does that|is this|is that|are we|can you|could you|would you|what do you|how well|should we|should i|why)\b/i;

const EXPLICIT_COMMAND =
  /^(?:please\s+)?(?:put|set|update|change|write|add|use)\b/i;

/** "improve the goal" names a section. "improve onboarding" does not. */
const REWRITE_NAMED_SECTION = new RegExp(
  `\\b(?:improve|evaluate|rewrite|reword|tighten|revise)\\s+(?:the\\s+)?${APPROVAL_SECTION}\\b`,
  'i',
);

/**
 * The section token has to sit against the command delimiter. A later "to"
 * in ordinary prose is not the payload.
 */
const COMMAND_SECTION = new RegExp(
  `\\b(?:put|set|update|change|write|add|use)\\s+(?:in(?:to)?|on|for|as|to)?\\s*(?:the\\s+)?(${APPROVAL_SECTION})\\b(?=\\s*(?:to\\b|:|["“]))`,
  'i',
);

const BARE_SECTION_COMMAND = new RegExp(
  `^(?:please\\s+)?(?:put|set|update|change|write|add|use)\\s+(?:in(?:to)?|on|for|as|to)?\\s*(?:the\\s+)?${APPROVAL_SECTION}\\s*[.!?]?$`,
  'i',
);

const VAGUE_ACTIVITY =
  /\b(?:test(?:ing)?(?:\s+out)?|try(?:ing)?|explor(?:e|ing)|check(?:ing)?|look(?:ing)?(?:\s+at)?|improv(?:e|ing)|experiment(?:ing)?|work(?:ing)?\s+on)\b/i;

const GOAL_SUCCESS_SIGNAL =
  /\d|\b(?:so that|so we|in order to|until|success|succeed|successful|recorded|verify that|passes|pass\/fail)\b/i;

export function isQuestSectionRejection(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 40) return false;
  return REJECTION_PHRASE.test(trimmed);
}

export function isQuestDraftQuestion(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || isQuestSectionApproval(trimmed)) return false;
  if (trimmed.endsWith('?')) return true;
  return QUESTION_OPENING.test(trimmed);
}

/**
 * A short goal that names an activity and no outcome. Structural, so a new
 * wording of the same shape is guided instead of stored as a finished goal.
 */
export function isVagueQuestGoal(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed || trimmed.length > 140) return false;
  if (GOAL_SUCCESS_SIGNAL.test(trimmed)) return false;
  return VAGUE_ACTIVITY.test(trimmed);
}

export type ExplicitQuestCommand = {
  step: QuestStewardStep;
  content: string;
};

function sectionFromCommandName(name: string): QuestStewardStep | null {
  const normalized = name.toLowerCase().replace(/\s+/g, ' ').trim();
  if (/^goals?$/.test(normalized)) return 'goal';
  if (/^scopes?$/.test(normalized)) return 'scope';
  if (/^success(?: criteria)?$/.test(normalized)) return 'success';
  if (/^milestones?$/.test(normalized)) return 'milestones';
  if (/^leads?$/.test(normalized)) return 'lead';
  if (/^members?$/.test(normalized)) return 'members';
  if (/^(?:quest\s+)?rewards?$/.test(normalized)) return 'rewards';
  if (/^target dates?$/.test(normalized)) return 'targetDate';
  if (/^(?:quest\s+)?(?:names?|titles?)$/.test(normalized)) return 'name';
  return null;
}

function unwrapCommandValue(value: string): string {
  let next = value.trim();
  const wrapped = /^["“]([\s\S]*)["”]$/.exec(next);
  if (wrapped?.[1]) next = wrapped[1].trim();
  return next.replace(/[.!]+$/g, '').trim();
}

function commandContent(text: string, sectionEnd: number): string | null {
  const after = text.slice(sectionEnd);
  const quoted = /^\s*["“]([^"”]+)["”]/.exec(after);
  if (quoted?.[1]?.trim()) return quoted[1].trim();
  const to = /^\s*to\b\s+(.+)$/is.exec(after);
  if (to?.[1]?.trim()) {
    const value = unwrapCommandValue(to[1]);
    return value || null;
  }
  const colon = /^\s*:\s*(.+)$/s.exec(after);
  if (colon?.[1]?.trim()) {
    const value = unwrapCommandValue(colon[1]);
    return value || null;
  }
  return null;
}

/** Imperative put/set/update with a section and real content. Not a confirmation. */
export function explicitQuestSectionCommand(
  text: string,
): ExplicitQuestCommand | null {
  const trimmed = text.trim();
  if (!EXPLICIT_COMMAND.test(trimmed)) return null;
  if (isQuestSectionApproval(trimmed)) return null;
  const match = COMMAND_SECTION.exec(trimmed);
  if (!match?.[1] || match.index === undefined) return null;
  const step = sectionFromCommandName(match[1]);
  if (!step) return null;
  const content = commandContent(trimmed, match.index + match[0].length);
  if (!content || /^(?:that|it|this)$/i.test(content)) return null;
  return { step, content };
}

export function vagueGoalGuidance(goal: string): string {
  const shown = goal.trim();
  return `“${shown}” gives an activity, but it does not say what the test outcome or success means. What behavior do you want to verify?`;
}

/** Drop a leading "goal is" / "Goal:" so the activity itself can be judged. */
export function goalStatement(text: string): string {
  const stripped = text
    .trim()
    .replace(/^(?:the\s+)?goal\s*:\s*/i, '')
    .replace(/^(?:the\s+)?goal\s+is\s+(?:to\s+)?/i, '')
    .trim();
  return stripped || text.trim();
}

/** Drop "Please write these as Success Criteria, proposing in chat first." */
export function stripQuestMetaInstructions(text: string): string {
  const without = text.replace(QUEST_META_INSTRUCTION, ' ');
  return without
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\s+([.!,])/g, '$1')
    .trim();
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
  const preview = formatPendingQuestPatch(patch).trim();
  const model = reply?.trim() ?? '';
  if (!preview) {
    if (model && /do you want that to be in the/i.test(model)) return model;
    return [model, question].filter(Boolean).join('\n\n');
  }
  const snippet = preview.slice(0, Math.min(40, preview.length));
  if (snippet.length > 0 && model.includes(snippet)) return model;
  return `${preview}\n\n${question}`;
}

/** "Out of scope:" stays out of the in-scope list, including on the next line. */
const OUT_OF_SCOPE_LABEL = /\b(?:out\s+of\s+scope|scope\s+out|out)\s*:/i;

function textBeforeOutOfScope(text: string): string {
  return text.split(OUT_OF_SCOPE_LABEL)[0]?.trim() ?? text.trim();
}

/**
 * Extract the active section from a user message.
 * A goal answer does not also invent scope, milestones, rewards, or a name.
 */
export function buildLocalQuestDraftPatch({
  message,
  currentStep,
  draft,
  viewerDisplayName,
}: {
  message: string;
  currentStep: QuestStewardStep;
  draft: QuestDraftStateSnapshot;
  viewerDisplayName: string;
}): QuestDraftPatchInput {
  const raw = message.trim();
  if (!raw || isBulkSectionDraftRequest(raw)) return {};
  if (
    isQuestDraftQuestion(raw) ||
    isQuestSectionRejection(raw) ||
    isQuestSectionApproval(raw)
  ) {
    return {};
  }
  const command = explicitQuestSectionCommand(raw);
  if (command) {
    const extracted = buildLocalQuestDraftPatch({
      message: command.content,
      currentStep: command.step,
      draft,
      viewerDisplayName,
    });
    return sanitizeQuestDraftPatch(
      limitQuestPatchToStep(extracted, command.step),
    );
  }
  if (BARE_SECTION_COMMAND.test(raw)) return {};
  if (
    EXPLICIT_COMMAND.test(raw) &&
    COMMAND_SECTION.test(raw) &&
    !isQuestSectionApproval(raw)
  ) {
    return {};
  }
  const trimmed = stripQuestMetaInstructions(raw);
  if (!trimmed) return {};

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
  if (inScopeMatch?.[1]) {
    const inText = textBeforeOutOfScope(inScopeMatch[1]);
    if (inText) patch.scopeIn = splitListItems(inText);
  }
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
      const milestones = parseRequestedMilestones(trimmed, viewerDisplayName);
      if (milestones.length > 0) patch.milestones = milestones;
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
        const responsibilities = respText ? splitListItems(respText) : [];
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

  return sanitizeQuestDraftPatch(limitQuestPatchToStep(patch, currentStep));
}

const MONTH_NAME =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

const MILESTONE_COUNT_WORD =
  'one|two|three|four|five|six|seven|eight|nine|ten|\\d+';

/** "Owner Ada Lovelace for all three." The count word is not part of a title. */
const SHARED_OWNER_SOURCE = `\\bowners?\\s*:?\\s*(.+?)\\s+for all(?:\\s+(?:${MILESTONE_COUNT_WORD}|of them|milestones?))*\\b[.!?]?`;

function extractRequestedDueDate(
  text: string,
): { raw: string; label: string } | null {
  const dayFirst = new RegExp(
    `\\b((?:due|by|on)\\s*)?(\\d{1,2})\\s*(${MONTH_NAME})\\s*(\\d{4})\\b`,
    'i',
  ).exec(text);
  if (dayFirst?.[2] && dayFirst[3] && dayFirst[4]) {
    return {
      raw: dayFirst[0],
      label: `${dayFirst[2]} ${dayFirst[3]} ${dayFirst[4]}`,
    };
  }
  const monthFirst = new RegExp(
    `\\b((?:due|by|on)\\s*)?(${MONTH_NAME})\\s*(\\d{1,2}),?\\s*(\\d{4})\\b`,
    'i',
  ).exec(text);
  if (monthFirst?.[2] && monthFirst[3] && monthFirst[4]) {
    return {
      raw: monthFirst[0],
      label: `${monthFirst[3]} ${monthFirst[2]} ${monthFirst[4]}`,
    };
  }
  const iso = /\b((?:due|by|on)\s*)?(\d{4}-\d{2}-\d{2})\b/i.exec(text);
  if (iso?.[2]) return { raw: iso[0], label: iso[2] };
  return null;
}

function isDateOnly(text: string): boolean {
  const due = extractRequestedDueDate(text);
  if (!due) return false;
  const rest = text
    .replace(due.raw, ' ')
    .replace(/\b(?:due|by|on)\b/gi, ' ')
    .replace(/[,;.\s]+/g, ' ')
    .trim();
  return rest.length === 0;
}

/** "Exactly 3 milestones:" is an instruction, not a checkpoint. */
function isMilestoneInstruction(text: string): boolean {
  const normalized = text
    .replace(/[:.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!normalized) return true;
  if (/^milestones?$/i.test(normalized)) return true;
  return new RegExp(
    `^(?:please\\s+)?(?:(?:exactly|only|just|add|create|propose|include|draft|write|make|give me|i want|i need)\\s+)*(?:exactly\\s+)?(?:${MILESTONE_COUNT_WORD})\\s+milestones?$`,
    'i',
  ).test(normalized);
}

function cleanOwnerName(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const name = raw
    .replace(
      new RegExp(
        `\\s+for all(?:\\s+(?:${MILESTONE_COUNT_WORD}|of them|milestones?))*\\b[.!?]?`,
        'i',
      ),
      '',
    )
    .replace(/^(?:owner|owned by)\s*[:,-]?\s+/i, '')
    .replace(/^by\s+/i, '')
    .replace(/[.!?,;:]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!name || isDateOnly(name) || isMilestoneInstruction(name)) {
    return undefined;
  }
  if (
    new RegExp(
      `^(?:for all|all|milestones?|${MILESTONE_COUNT_WORD})$`,
      'i',
    ).test(name)
  ) {
    return undefined;
  }
  return name;
}

function cleanMilestoneTitle(raw: string): string {
  let name = raw.replace(/\s+/g, ' ').trim();
  for (let pass = 0; pass < 2; pass += 1) {
    name = name
      .replace(/^(?:titled|called|named)\s*[:,-]?\s+/i, '')
      .replace(/^\s*milestones?\s*[:.-]\s*/i, '')
      .trim();
  }
  return name
    .replace(/\s*[,;.]+\s*(?=[,;.])/g, ' ')
    .replace(/[,;.\s]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isDashSeparatorChar(char: string): boolean {
  return (
    char === '-' || char === '\u2013' || char === '\u2014' || char.trim() === ''
  );
}

function containsDash(value: string): boolean {
  for (const char of value) {
    if (char === '-' || char === '\u2013' || char === '\u2014') return true;
  }
  return false;
}

/** Trailing " - " groups. A character scan — `(?:\s*[-–—]\s*)+` is polynomial ReDoS. */
function trimTrailingDashSeparators(value: string): string {
  let end = value.length;
  while (end > 0 && isDashSeparatorChar(value[end - 1] ?? '')) end -= 1;
  return value.slice(0, end);
}

function stripDanglingOwner(name: string, owner?: string): string {
  let next = name.trimEnd();
  const ownerName = owner?.trim();
  if (ownerName && next.toLowerCase().endsWith(ownerName.toLowerCase())) {
    const prefix = next.slice(0, next.length - ownerName.length);
    const trimmed = trimTrailingDashSeparators(prefix);
    if (containsDash(prefix.slice(trimmed.length))) next = trimmed;
  }
  return trimTrailingDashSeparators(next).trim();
}

function finishMilestoneTitle(raw: string, owner?: string): string {
  const stripped = stripQuestMetaInstructions(raw).replace(
    new RegExp(SHARED_OWNER_SOURCE, 'gi'),
    ' ',
  );
  return cleanMilestoneTitle(
    stripDanglingOwner(cleanMilestoneTitle(stripped), owner),
  );
}

function takeSharedOwner(text: string): { text: string; owner?: string } {
  const match = new RegExp(SHARED_OWNER_SOURCE, 'i').exec(text);
  const owner = cleanOwnerName(match?.[1]);
  const without = text
    .replace(new RegExp(SHARED_OWNER_SOURCE, 'gi'), ' ')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .trim();
  return { text: without, owner };
}

function stripLeadingMilestonePreamble(text: string): string {
  return text
    .replace(
      new RegExp(
        `^(?:please\\s+)?(?:(?:exactly|only|just|add|create|propose|include|draft|write|make)\\s+)+(?:exactly\\s+)?(?:${MILESTONE_COUNT_WORD})\\s+milestones?\\s*:\\s*`,
        'i',
      ),
      '',
    )
    .replace(/^\s*milestones?\s*:\s*/i, '')
    .trim();
}

function splitMilestoneRequestRows(text: string): string[] {
  const prepared = stripLeadingMilestonePreamble(text);
  const chunks = prepared
    .split(/\n+|;\s*/)
    .map((row) => row.trim())
    .filter((row) => row && !isMilestoneInstruction(row));
  const joined = chunks.join('\n');
  const rows = /\bM\d+\b/i.test(joined)
    ? joined
        .split(/\s*(?=\bM\d+\b)/i)
        .map((row) => row.trim())
        .filter(Boolean)
    : chunks;
  return rows.filter((row) => !isMilestoneInstruction(row));
}

/** "Title - 20 November 2026 - Ada Lovelace". A dash inside a title is left alone. */
function parseDashMilestone(body: string): {
  title: string;
  dueDate?: string;
  owner?: string;
} | null {
  const parts = body
    .split(/\s+[-–—]\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length < 2) return null;
  const dateIndex = parts.findIndex((part) => isDateOnly(part));
  if (dateIndex <= 0) return null;
  const title = cleanMilestoneTitle(parts.slice(0, dateIndex).join(' - '));
  if (!title || isMilestoneInstruction(title)) return null;
  const due = extractRequestedDueDate(parts[dateIndex] ?? '');
  const owner = cleanOwnerName(parts.slice(dateIndex + 1).join(' '));
  return {
    title,
    ...(due ? { dueDate: due.label } : {}),
    ...(owner ? { owner } : {}),
  };
}

/** Residue of removing a date from "title - date - owner". */
function peelBrokenDashOwner(body: string): { body: string; owner?: string } {
  const broken = /^(.*?)\s+[-–—](?:\s+[-–—])+\s+(.+)$/.exec(body);
  if (!broken?.[1] || !broken[2]) return { body };
  const owner = cleanOwnerName(broken[2]);
  if (!owner) return { body };
  return {
    body: trimTrailingDashSeparators(broken[1]).trim(),
    owner,
  };
}

/** Only the milestones the member named. No header row and no invented dates. */
function parseRequestedMilestones(
  text: string,
  viewerDisplayName: string,
): NonNullable<QuestDraftPatchInput['milestones']> {
  const shared = takeSharedOwner(text);
  return splitMilestoneRequestRows(shared.text)
    .map((row) => {
      let body = stripQuestMetaInstructions(row)
        .replace(/^(?:M\d+|[-*•]|\d+\.)\s*[:.)-]?\s*/i, '')
        .replace(new RegExp(SHARED_OWNER_SOURCE, 'gi'), ' ')
        .replace(/\s+/g, ' ')
        .trim();
      body = cleanMilestoneTitle(body);
      if (!body || isMilestoneInstruction(body)) return null;

      const dashed = parseDashMilestone(body);
      if (dashed) {
        const ownerName = dashed.owner || shared.owner || viewerDisplayName;
        const name = finishMilestoneTitle(dashed.title, ownerName);
        if (!name || isMilestoneInstruction(name)) return null;
        return {
          name,
          ...(dashed.dueDate ? { dueDate: dashed.dueDate } : {}),
          description: name,
          ownerName,
        };
      }

      let owner = shared.owner;
      const ownerOnRow = /(?:^|[,;]\s*)owner\s+([^,;.]+)$/i.exec(body);
      if (ownerOnRow?.[1] && !/\bfor all\b/i.test(ownerOnRow[1])) {
        owner = cleanOwnerName(ownerOnRow[1]) ?? owner;
        body = cleanMilestoneTitle(
          body.slice(0, ownerOnRow.index).replace(/[,;]\s*$/, ''),
        );
      }
      const due = extractRequestedDueDate(body);
      if (due) {
        body = cleanMilestoneTitle(
          body.replace(due.raw, ' ').replace(/\b(?:due|by|on)\s*$/i, ' '),
        );
      }
      const peeled = peelBrokenDashOwner(body);
      if (peeled.owner) owner = peeled.owner;
      const ownerName = owner || viewerDisplayName;
      const name = finishMilestoneTitle(peeled.body, ownerName);
      if (!name || isMilestoneInstruction(name)) return null;
      return {
        name,
        ...(due ? { dueDate: due.label } : {}),
        description: name,
        ownerName,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .slice(0, 6);
}

function cleanTextList(values: string[] | undefined): string[] | undefined {
  if (!values) return undefined;
  const cleaned = values
    .map((value) => stripQuestMetaInstructions(value).trim())
    .filter(Boolean);
  return cleaned.length > 0 ? cleaned : undefined;
}

function cleanOptionalText(value: string | undefined): string | undefined {
  const cleaned = value ? stripQuestMetaInstructions(value).trim() : '';
  return cleaned || undefined;
}

/** Meta instructions never land in a proposal or a form field. */
export function sanitizeQuestDraftPatch(
  patch: QuestDraftPatchInput,
): QuestDraftPatchInput {
  const next: QuestDraftPatchInput = {};
  const goal = cleanOptionalText(patch.goal);
  if (goal) next.goal = goal;
  const name = cleanOptionalText(patch.name);
  if (name) next.name = name;
  const leadName = cleanOptionalText(patch.leadName);
  if (leadName) next.leadName = leadName;
  const targetDate = cleanOptionalText(patch.targetDate);
  if (targetDate) next.targetDate = targetDate;
  const scopeIn = cleanTextList(patch.scopeIn);
  if (scopeIn) next.scopeIn = scopeIn;
  const scopeOut = cleanTextList(patch.scopeOut);
  if (scopeOut) next.scopeOut = scopeOut;
  const successCriteriaBullets = cleanTextList(patch.successCriteriaBullets);
  if (successCriteriaBullets) {
    next.successCriteriaBullets = successCriteriaBullets;
  }
  if (patch.milestones && patch.milestones.length > 0) {
    const milestones = patch.milestones
      .map((milestone) => {
        const ownerName = cleanOwnerName(
          cleanOptionalText(milestone.ownerName),
        );
        const dueDate = milestone.dueDate?.trim();
        const name = finishMilestoneTitle(milestone.name ?? '', ownerName);
        if (!name || isMilestoneInstruction(name)) return null;
        const description = milestone.description
          ? finishMilestoneTitle(milestone.description, ownerName)
          : undefined;
        return {
          name,
          ...(dueDate ? { dueDate } : {}),
          ...(description ? { description } : {}),
          ...(ownerName ? { ownerName } : {}),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (milestones.length > 0) next.milestones = milestones;
  }
  if (patch.members && patch.members.length > 0) {
    const members = patch.members
      .map((member) => {
        const memberName = cleanOptionalText(member.memberName);
        if (!memberName) return null;
        const responsibilities = cleanTextList(member.responsibilities);
        return {
          memberName,
          ...(member.roleLabel ? { roleLabel: member.roleLabel } : {}),
          ...(responsibilities ? { responsibilities } : {}),
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null);
    if (members.length > 0) next.members = members;
  }
  if (patch.rewards && patch.rewards.length > 0) next.rewards = patch.rewards;
  return next;
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
  const clean = sanitizeQuestDraftPatch(patch);
  const next: QuestDraftStateSnapshot = { ...current };
  const updatedLabels: string[] = [];

  if (clean.goal?.trim()) {
    next.goal = clean.goal.trim();
    updatedLabels.push('Goal');
  }

  if (
    (clean.scopeIn && clean.scopeIn.length > 0) ||
    (clean.scopeOut && clean.scopeOut.length > 0)
  ) {
    if (clean.scopeIn && clean.scopeIn.length > 0) {
      next.scopeIn = clean.scopeIn;
      next.scopeInMarkdown = bulletsToMarkdownList(clean.scopeIn);
    }
    if (clean.scopeOut && clean.scopeOut.length > 0) {
      next.scopeOut = clean.scopeOut;
      next.scopeOutMarkdown = bulletsToMarkdownList(clean.scopeOut);
    }
    updatedLabels.push('Scope');
  }

  if (clean.successCriteriaBullets && clean.successCriteriaBullets.length > 0) {
    next.successCriteria = bulletsToMarkdownList(clean.successCriteriaBullets);
    updatedLabels.push('Success criteria');
  }

  if (clean.milestones && clean.milestones.length > 0) {
    next.milestones = clean.milestones.map((m) => {
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

  if (clean.members && clean.members.length > 0) {
    const mapped = clean.members.map((m): EditableQuestMember => {
      const matched = matchQuestMemberByName(spaceMembers, m.memberName);
      return {
        personId: matched?.personId ?? null,
        memberName: matched?.name || m.memberName.trim(),
        memberAvatarUrl: matched?.avatarUrl ?? null,
        roleLabel: m.roleLabel?.trim() || 'Member',
        responsibilities: m.responsibilities ?? [],
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

  if (clean.leadName?.trim()) {
    const rawLead = stripViewerYouMarker(clean.leadName).trim();
    const matchedLead = matchQuestMemberByName(spaceMembers, rawLead);
    next.leadName = matchedLead?.name || rawLead;
    next.selectedLeadPersonId = matchedLead?.personId ?? null;
    updatedLabels.push('Lead');
  }

  if (clean.targetDate?.trim()) {
    next.targetDate = clean.targetDate.trim();
    updatedLabels.push('Target date');
  }

  if (clean.rewards && clean.rewards.length > 0) {
    const byToken = new Map<string, QuestReward>();
    for (const existing of next.rewards) {
      if (existing.amount.trim() && existing.token.trim()) {
        byToken.set(existing.token.toUpperCase(), existing);
      }
    }
    for (const item of clean.rewards) {
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

  if (clean.name?.trim()) {
    next.name = clean.name.trim();
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

export const QUEST_DRAFT_READY_REPLY =
  "Your quest draft is ready. Click CREATE QUEST whenever you're ready to submit it as a proposal for voting.";

export type QuestDraftTurnHistoryItem = {
  role: 'user' | 'agent';
  text: string;
};

export type QuestDraftModelTurn = {
  patch?: QuestDraftPatchInput | null;
  reply?: string | null;
};

export type NewQuestDraftTurnResult = {
  draft: QuestDraftStateSnapshot;
  wrote: boolean;
  pending: PendingQuestSectionProposal | null;
  focusStep: QuestStewardStep;
  reply: string;
};

function limitedModelPatch(
  model: QuestDraftModelTurn | null,
  step: QuestStewardStep,
): QuestDraftPatchInput {
  if (!model?.patch || Object.keys(model.patch).length === 0) return {};
  return sanitizeQuestDraftPatch(limitQuestPatchToStep(model.patch, step));
}

function withoutVagueGoal(patch: QuestDraftPatchInput): QuestDraftPatchInput {
  if (!patch.goal || !isVagueQuestGoal(patch.goal)) return patch;
  const rest = { ...patch };
  delete rest.goal;
  return rest;
}

/**
 * Shown when a conversational turn needed the model and none answered.
 * It does not invent a goal, a metric, or a next section.
 */
export const QUEST_HELPER_OFFLINE_REPLY =
  "I can't reach the assistant right now, so I won't guess wording or fill a section. Your draft is unchanged. Try again, or give the exact line to put in a section.";

/**
 * Local safety turns never call the model: yes/no for the current proposal,
 * and an explicit put/set/change with the words to store. Everything else —
 * questions, vague ideas, follow-ups, and rewrites — is a model turn, the
 * same way a Context section agent answers every mention.
 */
export function questDraftTurnUsesModel(message: string): boolean {
  const text = message.trim();
  if (!text || isBulkSectionDraftRequest(text)) return false;
  if (isQuestSectionApproval(text) || isQuestSectionRejection(text)) {
    return false;
  }
  if (explicitQuestSectionCommand(text) || BARE_SECTION_COMMAND.test(text)) {
    return false;
  }
  if (EXPLICIT_COMMAND.test(text) && COMMAND_SECTION.test(text)) return false;
  return true;
}

/**
 * A model reply that is trying to file the member's question as a section
 * is not guidance. The caller then says the assistant did not answer.
 */
function conversationalModelReply(
  model: QuestDraftModelTurn | null,
  userText: string,
): string | null {
  const reply = model?.reply?.trim() ?? '';
  if (!reply || reply === userText.trim()) return null;
  if (
    isQuestDraftQuestion(userText) &&
    /do you want that to be in the /i.test(reply)
  ) {
    return null;
  }
  return reply;
}

const PRIOR_SUGGESTION_OFFER =
  /\b(?:still (?:a |an )?suggestion|suggestion (?:above|earlier)|lines above|earlier suggestion|previous suggestion|that suggestion|those lines)\b/i;

const CONFIRM_TO_SAVE =
  /\b(?:until you (?:confirm|say yes|approve)|say yes|confirm (?:them|it|that|those)|approve (?:them|it|that|those)|if you confirm)\b/i;

/** A sentence that tells the member a prior suggestion is still saved by yes. */
function sentenceOffersRetiredConfirmation(sentence: string): boolean {
  return (
    PRIOR_SUGGESTION_OFFER.test(sentence) && CONFIRM_TO_SAVE.test(sentence)
  );
}

/**
 * A question leaves no suggestion for yes to save. Keep the answer, and drop
 * only a claim that confirmation of the retired suggestion would still work.
 */
function replyAfterRetiredSuggestion(
  reply: string,
  hadPending: boolean,
): string {
  const chunks = reply
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(Boolean);
  let changed = false;
  const kept = chunks.flatMap((part) => {
    if (!sentenceOffersRetiredConfirmation(part)) return [part];
    changed = true;
    PRIOR_SUGGESTION_OFFER.lastIndex = 0;
    const offer = PRIOR_SUGGESTION_OFFER.exec(part);
    const index = offer?.index ?? -1;
    if (index > 24) {
      const prefix = part
        .slice(0, index)
        .replace(/[\s,;:—-]+$/g, '')
        .trim();
      if (prefix.length > 12 && !sentenceOffersRetiredConfirmation(prefix)) {
        return [prefix];
      }
    }
    return [];
  });
  if (!changed) return reply;
  const notice = hadPending
    ? 'The earlier suggestion is no longer waiting on a yes.'
    : 'Nothing is waiting on a yes.';
  if (kept.length === 0) return notice;
  return `${kept.join('\n\n')}\n\n${notice}`;
}

function sectionLabelSource(step: QuestStewardStep): string {
  switch (step) {
    case 'goal':
      return 'goals?';
    case 'scope':
      return '(?:in[-\\s])?scope';
    case 'success':
      return 'success(?:\\s+criteria)?';
    case 'milestones':
      return 'milestones?';
    case 'members':
      return 'members?';
    case 'lead':
      return 'leads?';
    case 'targetDate':
      return 'target\\s+dates?';
    case 'rewards':
      return '(?:quest\\s+)?rewards?';
    case 'name':
      return '(?:quest\\s+)?(?:names?|titles?)';
  }
}

/**
 * Guidance is not a field value. A reply still asking for a missing decision,
 * or sending the sentence to another section, must not also become pending
 * content. A comment with no open question leaves the member's sentence pending.
 */
function modelGuidanceWithholdsFiling(
  reply: string,
  step: QuestStewardStep,
): boolean {
  const label = sectionLabelSource(step);
  const withoutFilingAsk = reply
    .replace(
      new RegExp(`do you want that to be in(?:\\s+the)?\\s+${label}\\??`, 'ig'),
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  if (/\?/.test(withoutFilingAsk)) return true;
  if (
    new RegExp(
      `\\b(?:not|isn'?t|is not|aren'?t|are not|rather than|instead of|outside(?:\\s+of)?)\\s+(?:(?:an?|the|this)\\s+)?(?:[\\w-]+\\s+){0,4}${label}\\b`,
      'i',
    ).test(withoutFilingAsk) ||
    /\bnot\s+(?:for\s+)?(?:this|the current)\s+section\b/i.test(
      withoutFilingAsk,
    )
  ) {
    return true;
  }
  const otherLabels = (Object.keys(QUEST_STEP_LABEL) as QuestStewardStep[])
    .filter((other) => other !== step)
    .map((other) => sectionLabelSource(other))
    .join('|');
  return new RegExp(
    `\\b(?:belongs in|goes in|put (?:that|this|it) in)\\s+(?:the\\s+)?(?:${otherLabels})\\b`,
    'i',
  ).test(withoutFilingAsk);
}

/**
 * One send on the new-quest helper. The create screen calls this after an
 * optional model turn. Only `wrote` updates the draft.
 */
export function runNewQuestDraftTurn({
  message,
  currentStep,
  draft,
  pending,
  viewerDisplayName,
  spaceMembers,
  model,
}: {
  message: string;
  currentStep: QuestStewardStep;
  draft: QuestDraftStateSnapshot;
  pending: PendingQuestSectionProposal | null;
  /** The model request carries this. Local turns do not answer from it. */
  history?: readonly QuestDraftTurnHistoryItem[];
  viewerDisplayName: string;
  spaceMembers: readonly QuestSpaceMember[];
  model: QuestDraftModelTurn | null;
}): NewQuestDraftTurnResult {
  const text = message.trim();
  const target = resolveQuestDraftTarget(text, currentStep);
  const stay = (
    reply: string,
    step: QuestStewardStep = currentStep,
    nextPending: PendingQuestSectionProposal | null = null,
  ): NewQuestDraftTurnResult => ({
    draft,
    wrote: false,
    pending: nextPending,
    focusStep: step,
    reply,
  });

  const finishApply = (
    step: QuestStewardStep,
    patch: QuestDraftPatchInput,
  ): NewQuestDraftTurnResult => {
    const limited = sanitizeQuestDraftPatch(limitQuestPatchToStep(patch, step));
    const { next, updatedLabels } = applyPatchToQuestDraftState({
      current: draft,
      patch: limited,
      spaceMembers,
      viewerDisplayName,
    });
    if (updatedLabels.length === 0) {
      return {
        draft,
        wrote: false,
        pending: null,
        focusStep: currentStep,
        reply: `Nothing is waiting on a yes. ${stewardQuestionForStep(
          currentStep,
        )}`,
      };
    }
    if (step === 'goal' && isVagueQuestGoal(next.goal)) {
      return {
        draft: next,
        wrote: true,
        pending: null,
        focusStep: 'goal',
        reply: `Added that to the Goal.\n\n${vagueGoalGuidance(next.goal)}`,
      };
    }
    const advance = nextQuestStepAfterUpdate({
      draft: next,
      currentStep: step,
      updatedLabels,
    });
    const reply = advance.complete
      ? QUEST_DRAFT_READY_REPLY
      : `Added that to the ${questStepSectionLabel(
          step,
        )}. ${stewardQuestionForStep(advance.step)}`;
    return {
      draft: next,
      wrote: true,
      pending: null,
      focusStep: advance.step,
      reply,
    };
  };

  if (!text || target.bulk || isBulkSectionDraftRequest(text)) {
    return stay(
      `We'll take one section at a time. ${stewardQuestionForStep(
        currentStep,
      )}`,
    );
  }

  if (isQuestSectionApproval(text)) {
    const named = sectionNamedInApproval(text);
    const pendingPatch = pending?.patch ?? {};
    const hasPending = Object.keys(pendingPatch).length > 0;
    if (pending && hasPending && (!named || named === pending.step)) {
      return finishApply(pending.step, pending.patch);
    }
    return stay(
      `Nothing is waiting on a yes. ${stewardQuestionForStep(currentStep)}`,
    );
  }

  const command = explicitQuestSectionCommand(text);
  if (command) {
    const extracted = buildLocalQuestDraftPatch({
      message: command.content,
      currentStep: command.step,
      draft,
      viewerDisplayName,
    });
    return finishApply(command.step, extracted);
  }

  if (isQuestSectionRejection(text)) {
    const step = pending?.step ?? currentStep;
    return stay(`Okay, I left that out. ${stewardQuestionForStep(step)}`, step);
  }

  if (isQuestDraftQuestion(text)) {
    // A question answers in chat. It does not file the question, and it
    // disarms the previous proposal so a later bare yes cannot apply it.
    const hadPending = Object.keys(pending?.patch ?? {}).length > 0;
    const modelReply =
      conversationalModelReply(model, text) ?? QUEST_HELPER_OFFLINE_REPLY;
    return stay(
      replyAfterRetiredSuggestion(modelReply, hadPending),
      currentStep,
    );
  }

  if (isQuestSectionCoachingOpener(text)) {
    return stay(
      conversationalModelReply(model, text) ?? QUEST_HELPER_OFFLINE_REPLY,
      target.step,
    );
  }

  if (isQuestSectionRewriteRequest(text) && REWRITE_NAMED_SECTION.test(text)) {
    const suggested = withoutVagueGoal(limitedModelPatch(model, target.step));
    if (Object.keys(suggested).length > 0) {
      return stay(
        `Suggested refinement, not saved yet:\n${replyWithSectionApprovalAsk(
          null,
          target.step,
          suggested,
        )}`,
        target.step,
        { step: target.step, patch: suggested },
      );
    }
    return stay(
      conversationalModelReply(model, text) ??
        `I won't replace the ${questStepSectionLabel(
          target.step,
        )} until you approve a wording. What should change?`,
      target.step,
    );
  }

  if (
    (target.step === 'goal' || currentStep === 'goal') &&
    isVagueQuestGoal(goalStatement(text))
  ) {
    const reply = conversationalModelReply(model, text);
    const suggested = withoutVagueGoal(limitedModelPatch(model, 'goal'));
    if (reply && Object.keys(suggested).length > 0) {
      return stay(`Suggested refinement, not saved yet:\n${reply}`, 'goal', {
        step: 'goal',
        patch: suggested,
      });
    }
    return stay(reply ?? QUEST_HELPER_OFFLINE_REPLY, 'goal');
  }

  const supplied = messageSuppliesSectionContent(text)
    ? withoutVagueGoal(
        sanitizeQuestDraftPatch(
          limitQuestPatchToStep(
            buildLocalQuestDraftPatch({
              message: text,
              currentStep: target.step,
              draft,
              viewerDisplayName,
            }),
            target.step,
          ),
        ),
      )
    : {};
  if (Object.keys(supplied).length > 0) {
    const modelReply = conversationalModelReply(model, text);
    if (modelReply && modelGuidanceWithholdsFiling(modelReply, target.step)) {
      // Keep an unrelated proposal. Do not file this sentence over it.
      return stay(modelReply, currentStep, pending);
    }
    const ask = replyWithSectionApprovalAsk(null, target.step, supplied);
    return stay(
      modelReply ? `${modelReply}\n\nNot saved yet.\n${ask}` : ask,
      target.step,
      { step: target.step, patch: supplied },
    );
  }

  const suggested = limitedModelPatch(model, target.step);
  if (Object.keys(suggested).length > 0) {
    return stay(
      `Suggested refinement, not saved yet:\n${replyWithSectionApprovalAsk(
        null,
        target.step,
        suggested,
      )}`,
      target.step,
      { step: target.step, patch: suggested },
    );
  }

  const modelReply = conversationalModelReply(model, text);
  if (modelReply) return stay(modelReply, target.step);
  return stay(QUEST_HELPER_OFFLINE_REPLY, target.step);
}

export type CreateDraftTurnSnapshot = {
  draft: QuestDraftStateSnapshot;
  pending: PendingQuestSectionProposal | null;
  currentStep: QuestStewardStep;
};

/**
 * Run one create-screen turn. Model fetches re-read the draft and pending
 * after they resolve, and a superseded send produces no result to commit.
 */
export async function settleCreateDraftTurn({
  message,
  history = [],
  viewerDisplayName,
  spaceMembers,
  readState,
  isCurrent,
  loadModel,
}: {
  message: string;
  history?: readonly QuestDraftTurnHistoryItem[];
  viewerDisplayName: string;
  spaceMembers: readonly QuestSpaceMember[];
  readState: () => CreateDraftTurnSnapshot;
  isCurrent: () => boolean;
  loadModel: () => Promise<QuestDraftModelTurn | null>;
}): Promise<NewQuestDraftTurnResult | null> {
  const run = (model: QuestDraftModelTurn | null) => {
    if (!isCurrent()) return null;
    const latest = readState();
    return runNewQuestDraftTurn({
      message,
      currentStep: latest.currentStep,
      draft: latest.draft,
      pending: latest.pending,
      history,
      viewerDisplayName,
      spaceMembers,
      model,
    });
  };

  if (!questDraftTurnUsesModel(message)) return run(null);

  let model: QuestDraftModelTurn | null = null;
  try {
    model = await loadModel();
  } catch {
    model = null;
  }
  return run(model);
}
