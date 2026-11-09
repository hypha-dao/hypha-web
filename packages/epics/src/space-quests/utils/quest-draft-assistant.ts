import {
  QUEST_STEWARD_STEPS,
  bulletsToMarkdownList,
  QUEST_HELPER_NAME,
  isBulkQuestDraftRequest,
  labeledQuestDraftSection,
  limitQuestPatchToStep,
  questDraftCoachedStep,
  questDraftPatchSection,
  questEditRequestSection,
  questPendingYesNotice,
  questWordingRevisionStep,
  scopeBoundaryLists,
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
  members: 'Participants',
  lead: 'Lead',
  targetDate: 'Target date',
  rewards: 'Quest Reward',
  name: 'Name',
};

export function questStepSectionLabel(step: QuestStewardStep): string {
  return QUEST_STEP_LABEL[step];
}

const APPROVAL_SECTION =
  '(?:success\\s+criteria|milestones?|participants?|members?|target\\s+date|quest\\s+rewards?|rewards?|scope|success|lead|goal|name|title)';

const APPROVAL_PHRASE = `(?:yeah|yep|yup|okay|yes|ok|sure|approved|i approve|include that|include it|put that in(?: the)?(?:\\s+${APPROVAL_SECTION})?|put it in(?: the)?(?:\\s+${APPROVAL_SECTION})?|use that|use it|looks good|go ahead|add it|apply it|that(?:'s| is) good|perfect|do it|sounds good)`;

/** Tester lines that must never be proposed or written into a section. */
const QUEST_META_INSTRUCTION =
  /(?:^|[\s.])please\s+(?:write|propose|rewrite|include|put|draft|use)\b(?:(?![.!\n]).){0,240}?\bin chat first\b[^.!\n]*[.!?]?/gi;

const SECTION_REWRITE =
  /\b(improve|evaluate|rewrite|reword|tighten|revise|suggest(?:\s+\w+){0,3}\s+(?:wording|copy|text)|make (?:this|it|that) (?:sharper|clearer|shorter|better))\b/i;

const SECTION_OPENER =
  /\b(?:let'?s|let us|now)\b.{0,48}\b(?:define|talk about|work on|move on|start|cover)\b|\b(?:define|talk about|work on|move on to|start on|cover)\s+(?:the\s+)?(success\s+criteria|in[-\s]?scope|out[-\s]of[-\s]?scope|milestones?|participants?|members?|target\s+date|quest\s+rewards?|rewards?|quest\s+name|scope|success|lead|goal|name|title)\b|\b(what is|what['\u2019]s|how (?:do|should) (?:i|we)|help me (?:think|understand)|explain)\b/i;

const APPROVAL_REF_NOUN =
  '(?:suggestions?|wording|versions?|text|drafts?|proposals?|items?|lines?|bullets?|points?|things?)';

/** "the goal", "goal suggestion", "those items", "all of them", "it". */
const APPROVAL_REF = `(?:(?:all\\s+(?:of\\s+)?|both\\s+(?:of\\s+)?)?(?:(?:(?:the|that|this|those|these|your|my|our)\\s+)?(?:(?:suggested|proposed|new)\\s+)?(?:${APPROVAL_SECTION}(?:\\s+${APPROVAL_REF_NOUN})?|${APPROVAL_REF_NOUN})|it|that|this|them|those|these)|all|both)`;

const APPROVAL_FINE =
  '(?:good|great|fine|right|perfect|correct|ok|okay|clear|solid)';

/**
 * One piece of a confirmation. A message counts as approval only when every
 * piece is one of these, so "yes, make a goal from it" stays content.
 */
const APPROVAL_CLAUSE = [
  APPROVAL_PHRASE,
  'please',
  'thanks|thank you',
  `(?:(?:i|we)\\s+)?(?:confirm|accept|approve)(?:\\s+${APPROVAL_REF})?`,
  'confirmed|accepted|agreed|lgtm|great|correct|exactly|absolutely|definitely|of course|works for me|that works|all good|good',
  `(?:(?:i|we)\\s+)?agree(?:\\s+with\\s+${APPROVAL_REF})?`,
  `(?:i|we)\\s+(?:really\\s+)?(?:like|love)\\s+${APPROVAL_REF}`,
  `(?:like|love)\\s+(?:it|that|this)`,
  `(?:yes|yeah|yep|ok|okay|sure)\\s+(?:to|for)\\s+${APPROVAL_REF}`,
  `(?:(?:let'?s|let us|please|you can|go ahead and)\\s+)?(?:save|keep|apply|use|take|go with)(?:\\s+${APPROVAL_REF})?(?:\\s+(?:to|in|into|as)\\s+(?:the\\s+)?${APPROVAL_SECTION})?`,
  `(?:(?:let'?s|let us|please|you can|go ahead and)\\s+)?(?:add|put|include|insert)\\s+${APPROVAL_REF}(?:\\s+(?:to|in|into|as)\\s+(?:the\\s+)?${APPROVAL_SECTION}(?:\\s+section)?)?`,
  `${APPROVAL_REF}(?:'s|\\s+is|\\s+looks|\\s+sounds|\\s+seems)\\s+(?:really\\s+)?${APPROVAL_FINE}`,
  "(?:let'?s\\s+)?(?:move\\s+on|continue|proceed)",
  'next(?:\\s+section)?',
].join('|');

const APPROVAL_SEPARATOR =
  '(?:\\s*[,;\u2014\u2013]\\s*|\\s*[.!]+\\s*|\\s+-\\s+|\\s+)(?:(?:and\\s+)?(?:so|then)\\s+|and\\s+)?';

const APPROVAL_MESSAGE = new RegExp(
  `^(?:${APPROVAL_CLAUSE})(?:${APPROVAL_SEPARATOR}(?:${APPROVAL_CLAUSE}))*$`,
  'i',
);

/**
 * "yes", "Yes, put that in the Goal.", "I confirm the goal", "yes to goal
 * suggestion", "let's save it", "I like the goal". A longer answer that
 * only starts with yes is still content.
 */
export function isQuestSectionApproval(message: string): boolean {
  const text = message
    .trim()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[.!]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text || text.length > 120) return false;
  if (
    /\b(but|except|instead|rather|change|don't|do not|not|never|wait)\b/i.test(
      text,
    )
  ) {
    return false;
  }
  if (SECTION_REWRITE.test(text)) return false;
  return APPROVAL_MESSAGE.test(text);
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

export function questDraftSuggestionStatus(
  message: string,
  pending: PendingQuestSectionProposal | null,
): {
  status: 'none' | 'awaiting' | 'retired' | 'revising';
  step?: QuestStewardStep;
} {
  if (!pending || Object.keys(pending.patch).length === 0) {
    return { status: 'none' };
  }
  if (isQuestDraftQuestion(message)) {
    return { status: 'retired', step: pending.step };
  }
  const revision = questWordingRevisionStep(message, pending.step);
  if (revision) return { status: 'revising', step: revision };
  return { status: 'awaiting', step: pending.step };
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
  if (/^(?:members?|participants?)$/.test(normalized)) return 'members';
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
  // A request to propose a revision is not the wording to save.
  if (questWordingRevisionStep(text, null)) return false;
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
      return 'Participants are people from this space who own an outcome, not a job title. Each person should have one or two responsibilities you could check. Who needs to be on this quest, and what do they own?';
    case 'lead':
      return 'The lead is the one participant accountable for the quest as a whole. Who should carry that?';
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

/** In an approval, any section word names the suggestion: "I confirm the goal". */
function sectionNamedInApproval(message: string): QuestStewardStep | null {
  const named =
    /\b(success\s+criteria|milestones?|participants?|members?|target\s+date|rewards?|scope|success|lead|goal|name|title)\b/i.exec(
      message,
    );
  if (!named?.[1]) return null;
  const raw = named[1].toLowerCase();
  if (raw.includes('scope')) return 'scope';
  if (raw.includes('success')) return 'success';
  if (raw.includes('milestone')) return 'milestones';
  if (raw.includes('member') || raw.includes('participant')) return 'members';
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

const QUEST_ASSIST_HISTORY_LIMIT = 20;
const QUEST_ASSIST_HISTORY_TEXT_MAX = 2000;

/**
 * History the draft-assist schema accepts. A longer helper reply would
 * otherwise fail the next turn and look like the assistant is offline.
 */
export function questAssistHistoryEntries(
  history: readonly { role: string; text: string }[],
): { role: 'user' | 'assistant'; text: string }[] {
  return history.slice(-QUEST_ASSIST_HISTORY_LIMIT).map((entry) => ({
    role: entry.role === 'user' ? 'user' : 'assistant',
    text: entry.text.slice(0, QUEST_ASSIST_HISTORY_TEXT_MAX),
  }));
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
  commandPayload = false,
}: {
  message: string;
  currentStep: QuestStewardStep;
  draft: QuestDraftStateSnapshot;
  viewerDisplayName: string;
  /** The member named one section and gave this text to store. */
  commandPayload?: boolean;
}): QuestDraftPatchInput {
  const raw = message.trim();
  if (!raw || (!commandPayload && isBulkSectionDraftRequest(raw))) return {};
  // The quoted value of "Set the name to \"Yes\"" is the field, not a yes.
  if (
    !commandPayload &&
    (isQuestDraftQuestion(raw) ||
      isQuestSectionRejection(raw) ||
      isQuestSectionApproval(raw))
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
      commandPayload: true,
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
  if (!patch.scopeIn?.length && !patch.scopeOut?.length) {
    const boundary = scopeBoundaryLists(trimmed);
    if (boundary) {
      const scopeIn = splitListItems(boundary.scopeIn);
      const scopeOut = splitListItems(boundary.scopeOut);
      if (scopeIn.length > 0) patch.scopeIn = scopeIn;
      if (scopeOut.length > 0) patch.scopeOut = scopeOut;
    }
  }
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

  // Conversational prose is not a section value. An explicit command, or a
  // message that labels this section, stores that payload. A model tool
  // patch is the suggestion for everything else.
  const labeledStep = labeledQuestDraftSection(trimmed);
  if (
    (commandPayload || labeledStep === currentStep) &&
    !stepFieldsAlreadyCaptured(patch, currentStep)
  ) {
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
          roleLabel: 'Participant',
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
        roleLabel: m.roleLabel?.trim() || 'Participant',
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
    updatedLabels.push('Participants');
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
 * The create screen trims the composer, then drops a leading @Quest Helper
 * or @AI Agents mention. The rest of the turn sees that string only.
 */
export function questHelperTurnMessage(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  const helper = QUEST_HELPER_NAME.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutMention = trimmed
    .replace(new RegExp(`^@(?:${helper}|AI[\\s_-]*Agents)\\b[,:\\s]*`, 'i'), '')
    .trim();
  return withoutMention || trimmed;
}

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

/**
 * The model does not own pending or saved state. Drop a sentence that
 * claims something is waiting, not waiting, saved, not saved, or suggested
 * above. The app appends one line from the real card, or none.
 */
const MODEL_STATE_CLAIM =
  /\b(?:waiting|sav(?:ed|es)|suggested above|suggestion above|do you want that to be in)\b|(?<!\b(?:once|when|until|after|if|before|unless)\s+(?:the\s+|your\s+)?)\b(?:goal|scope|success\s+criteria|milestones?|members?|lead|target\s+date|(?:quest\s+)?rewards?|name)(?:'s|\s+(?:is|are|has\s+been|have\s+been))\s+(?:now\s+)?(?:set|added|applied|filled(?:\s+in)?|recorded|in\s+place|locked(?:\s+in)?|done)\b|\b(?:i(?:'ve|\s+have)|we(?:'ve|\s+have))\s+(?:now\s+)?(?:added|applied|set|filled|recorded|put|changed|updated|edited|saved)\b|\badded\s+(?:that|it|those|these|them)\s+to\b|\bnow\s+reads\b|\bnow\s+(?:says|includes)\b|\b(?:has been|was|is now)\s+(?:changed|updated|saved|edited)\b/i;

function stripModelStateClaims(reply: string): string {
  const pieces = reply.split(/(\n+|(?<=[.!?])\s+)/);
  let kept = '';
  for (let index = 0; index < pieces.length; index += 2) {
    const sentence = pieces[index] ?? '';
    const separator = pieces[index + 1] ?? '';
    if (!sentence.trim() || MODEL_STATE_CLAIM.test(sentence)) continue;
    kept += sentence + separator;
  }
  return kept
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Drop a model sentence that claims a section changed, was saved, or
 * "now reads" when no patch was filed. An empty result means the reply
 * was only that claim.
 */
export function replyWithoutUnbackedEditClaim(reply: string): string {
  const stripped = stripModelStateClaims(reply).trim();
  if (!stripped || /^[.\s]+$/.test(stripped)) return '';
  return stripped;
}

/** Shown when an edit named a section and no patch was filed for it. */
export const QUEST_EDIT_NOT_FILED_REPLY =
  'I did not file a suggestion for that section, so nothing changed.';

/**
 * A question leaves no suggestion for yes to save. Keep the answer. When the
 * model claimed a retired suggestion was still confirmable, say that it is not.
 */
function replyAfterRetiredSuggestion(
  reply: string,
  hadPending: boolean,
): string {
  const body = stripModelStateClaims(reply);
  const removedClaim = body.trim() !== reply.trim();
  if (!hadPending || !removedClaim) return body;
  const notice = 'The earlier suggestion is no longer waiting on a yes.';
  if (!body) return notice;
  if (body.includes(notice)) return body;
  return `${body}\n\n${notice}`;
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
      return '(?:members?|participants?)';
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
 * A question that still needs a fact or a choice. An optional aside does not.
 */
const MISSING_DECISION =
  /\b(?:do you mean|which|what|who|how|when|where|why|whether)\b/i;

/**
 * Guidance is not a field value. A reply still asking for a missing decision,
 * or sending the sentence to another section, must not also become pending
 * content. A finished tool suggestion can still mention an optional revision.
 */
/** The sentence that asks, not the finished statement before it. */
function questionSentence(chunk: string): string {
  const sentences = chunk
    .split(/(?<=[.!])\s+|\n+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  return sentences.find((part) => part.includes('?')) ?? chunk.trim();
}

/** "Want to keep it this length, or name where the notes live?" is an aside. */
function questionIsOptionalAside(question: string): boolean {
  return /^(?:want to|if you want|you can also|optionally)\b/i.test(
    question.trim(),
  );
}

/**
 * "Should this cover new members or existing members?" is still a choice.
 * A later "or" inside a completeness check is not, and neither is a bare or.
 */
const UNRESOLVED_CHOICE =
  /^(?:should|do you|would you|could you|shall)\b[\s\S]{0,180}\bor\b/i;

/**
 * A finished proposal can ask whether to add something else.
 * "Should anything else be in scope, or is it covered by the items above?"
 * does not reopen those items. "Does reward display mean checking or
 * issuing?", "Still open", and "Do you mean A or B?" do.
 */
function questionIsOptionalAddition(question: string): boolean {
  const text = question.trim();
  if (/\bstill open\b/i.test(text)) return false;
  if (/\bdo you mean\b/i.test(text)) return false;
  if (/\bdoes\b[\s\S]{0,200}\bmean\b/i.test(text)) return false;
  const withoutExamples = text
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\bfor example\b[^,]*/gi, ' ');
  const asksToAddMore =
    /\b(?:should|could|would)\s+(?:anything|something|we|i)\b/i.test(
      withoutExamples,
    ) ||
    /\b(?:anything else|anything more|also include|also add)\b/i.test(
      withoutExamples,
    );
  const alreadyCovered =
    /\bor\b[\s\S]{0,80}\b(?:is it |it is )?(?:already )?(?:covered|included|enough)\b/i.test(
      withoutExamples,
    );
  if (!asksToAddMore || !alreadyCovered) return false;
  const beforeCovered = withoutExamples.replace(
    /\bor\b[\s\S]{0,80}\b(?:is it |it is )?(?:already )?(?:covered|included|enough)\b[\s\S]*$/i,
    '',
  );
  return !/\bor\b/i.test(beforeCovered);
}

/**
 * "Next: success criteria — what could a reviewer check…?" invites the
 * following section. It does not leave the section being filed undecided.
 * A choice, or the same question about the section itself, still withholds.
 */
function questionIsNextSectionPrompt(
  question: string,
  step: QuestStewardStep,
): boolean {
  const text = question.trim();
  if (
    UNRESOLVED_CHOICE.test(text) ||
    /\b(?:do you mean|which|who|whether)\b/i.test(text) ||
    /\bstill open\b/i.test(text) ||
    /\bdoes\b[\s\S]{0,180}\bmean\b/i.test(text)
  ) {
    return false;
  }
  const next =
    /^next\s*:\s*(success(?:\s+criteria)?|milestones?|participants?|members?|(?:quest\s+)?rewards?|(?:in[-\s])?scope|goals?|leads?|(?:quest\s+)?(?:names?|titles?)|target\s+dates?)\b/i.exec(
      text,
    );
  if (next) {
    const label = (next[1] ?? '').toLowerCase();
    const sameSection =
      (step === 'success' && /success|criteria/.test(label)) ||
      (step === 'milestones' && /milestone/.test(label)) ||
      (step === 'members' && /member|participant/.test(label)) ||
      (step === 'rewards' && /reward/.test(label)) ||
      (step === 'scope' && /scope/.test(label)) ||
      (step === 'goal' && /goal/.test(label)) ||
      (step === 'lead' && /lead/.test(label)) ||
      (step === 'name' && /name|title/.test(label)) ||
      (step === 'targetDate' && /date/.test(label));
    return !sameSection;
  }
  return step !== 'success' && /\bwhat could a reviewer check\b/i.test(text);
}

function modelGuidanceWithholdsFiling(
  reply: string,
  step: QuestStewardStep,
): boolean {
  const label = sectionLabelSource(step);
  const questions = reply
    .split(/(?<=\?)\s+/)
    .map((part) => questionSentence(part))
    .filter(
      (part) =>
        part.includes('?') &&
        !questionIsOptionalAside(part) &&
        !questionIsNextSectionPrompt(part, step) &&
        !questionIsOptionalAddition(part),
    );
  if (
    questions.some(
      (question) =>
        MISSING_DECISION.test(question) ||
        UNRESOLVED_CHOICE.test(question) ||
        /\bstill open\b/i.test(question) ||
        /\bdoes\b[\s\S]{0,180}\bmean\b/i.test(question),
    )
  ) {
    return true;
  }
  const withoutFilingAsk = reply
    .replace(
      new RegExp(`do you want that to be in(?:\\s+the)?\\s+${label}\\??`, 'ig'),
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
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
 * What this turn may offer. An explicit labeled payload is the member's
 * proposal. Otherwise the model tool patch is the only confirmable text.
 * Prose on its own, and the raw message, are never a proposal.
 */
export type QuestDraftSuggestionDecision = {
  intent: 'clarify' | 'propose';
  patch: QuestDraftPatchInput;
};

export function decideQuestDraftSuggestion({
  message,
  step,
  memberPatch,
  model,
}: {
  message: string;
  step: QuestStewardStep;
  memberPatch: QuestDraftPatchInput;
  model: QuestDraftModelTurn | null;
}): QuestDraftSuggestionDecision {
  const reply = model?.reply?.trim() ?? '';
  const clarifying =
    reply.length > 0 && modelGuidanceWithholdsFiling(reply, step);
  const labeled =
    Object.keys(memberPatch).length > 0 &&
    (labeledQuestDraftSection(message) === step ||
      (step === 'scope' && scopeBoundaryLists(message) != null));
  if (labeled || (!clarifying && Object.keys(memberPatch).length > 0)) {
    return { intent: 'propose', patch: memberPatch };
  }
  const modelPatch = questWordingRevisionStep(message, step)
    ? limitedModelPatch(model, step)
    : withoutVagueGoal(limitedModelPatch(model, step));
  // A finished tool patch is the card. A reply that still needs a decision
  // withholds it, including on a proposal turn. Prose never becomes the card.
  if (!clarifying && Object.keys(modelPatch).length > 0) {
    return { intent: 'propose', patch: modelPatch };
  }
  return { intent: 'clarify', patch: {} };
}

/**
 * A new suggestion may replace an older one only when the member's message
 * itself names that section. The model reply does not.
 */
function memberMessageReplacesPending(
  message: string,
  step: QuestStewardStep,
): boolean {
  if (labeledQuestDraftSection(message) === step) return true;
  if (step === 'scope' && scopeBoundaryLists(message) != null) return true;
  return questWordingRevisionStep(message, step) === step;
}

/**
 * The member asked to change the suggestion that is waiting, and this turn
 * has no confirmable replacement. Yes must not save the superseded wording,
 * and the chat text is not a substitute for it.
 */
function replyAfterUnconfirmedRevision(
  reply: string,
  step: QuestStewardStep,
): string {
  const section = questStepSectionLabel(step);
  const source = withoutExactNotice(reply, questPendingYesNotice(step));
  const stripped = replyAfterRetiredSuggestion(source, false);
  const body = stripped
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter(
      (part) =>
        part.length > 0 &&
        !/\b(?:nothing is waiting on a yes|no longer waiting|still waiting on a yes|yes applies that)\b/i.test(
          part,
        ),
    )
    .join('\n\n')
    .trim();
  const explanation = `I did not capture a replacement ${section} suggestion. The earlier ${section} suggestion is no longer waiting on a yes, and yes will not save this chat.`;
  return body ? `${body}\n\n${explanation}` : explanation;
}

function replyForPendingSuggestion(
  modelReply: string | null,
  step: QuestStewardStep,
  patch: QuestDraftPatchInput,
): string {
  const cleaned = stripModelStateClaims(
    (modelReply ?? '')
      .replace(
        new RegExp(
          `do you want that to be in(?:\\s+the)?\\s+${sectionLabelSource(
            step,
          )}\\??`,
          'ig',
        ),
        '',
      )
      .split(/\n+|(?<=[.!?])\s+/)
      .map((part) => part.trim())
      .filter(
        (part) => part.length > 0 && !/\bone section at a time\b/i.test(part),
      )
      .join('\n\n'),
  );
  const ask = replyWithSectionApprovalAsk(cleaned, step, patch);
  const question = questSectionApprovalQuestion(step);
  if (ask === cleaned) {
    return cleaned
      ? `${cleaned}\n\nNot saved yet.\n${question}`
      : `Not saved yet.\n${question}`;
  }
  if (!cleaned) return `Not saved yet.\n${ask}`;
  return `${cleaned}\n\nNot saved yet.\n${ask}`;
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
  voice = 'create',
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
  /** Saved-quest chat must not ask the create-flow questions. */
  voice?: 'create' | 'saved';
}): NewQuestDraftTurnResult {
  const text = message.trim();
  const pendingStep =
    pending && Object.keys(pending.patch).length > 0 ? pending.step : null;
  const target = questDraftCoachedStep(text, currentStep, pendingStep);
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
        reply:
          voice === 'saved'
            ? 'Nothing is waiting to confirm.'
            : `Nothing is waiting on a yes. ${stewardQuestionForStep(
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
      voice === 'saved'
        ? 'Tell me one section to change.'
        : `We'll take one section at a time. ${stewardQuestionForStep(
            currentStep,
          )}`,
    );
  }

  // An explicit command writes immediately. "yes" is not a command, so a
  // confirmation still applies the suggestion that is already waiting.
  const command = explicitQuestSectionCommand(text);
  if (command) {
    const extracted = buildLocalQuestDraftPatch({
      message: command.content,
      currentStep: command.step,
      draft,
      viewerDisplayName,
      commandPayload: true,
    });
    if (voice === 'saved') {
      const patch = sanitizeQuestDraftPatch(
        limitQuestPatchToStep(extracted, command.step),
      );
      if (Object.keys(patch).length === 0) {
        return stay(QUEST_EDIT_NOT_FILED_REPLY, command.step);
      }
      return stay(
        replyForPendingSuggestion(null, command.step, patch),
        command.step,
        { step: command.step, patch },
      );
    }
    return finishApply(command.step, extracted);
  }

  if (isQuestSectionApproval(text)) {
    const named = sectionNamedInApproval(text);
    const pendingPatch = pending?.patch ?? {};
    const hasPending = Object.keys(pendingPatch).length > 0;
    if (pending && hasPending && (!named || named === pending.step)) {
      return finishApply(pending.step, pending.patch);
    }
    if (pending && hasPending) {
      return stay(questPendingYesNotice(pending.step), currentStep, pending);
    }
    return stay(
      voice === 'saved'
        ? 'Nothing is waiting to confirm.'
        : `Nothing is waiting on a yes. ${stewardQuestionForStep(currentStep)}`,
    );
  }

  if (isQuestSectionRejection(text)) {
    const step = pending?.step ?? currentStep;
    return stay(
      voice === 'saved'
        ? 'Okay, I left that out.'
        : `Okay, I left that out. ${stewardQuestionForStep(step)}`,
      step,
    );
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
      replyAfterRetiredSuggestion(
        conversationalModelReply(model, text) ?? QUEST_HELPER_OFFLINE_REPLY,
        false,
      ),
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
      replyAfterRetiredSuggestion(
        conversationalModelReply(model, text) ??
          `I won't replace the ${questStepSectionLabel(
            target.step,
          )} until you approve a wording. What should change?`,
        false,
      ),
      target.step,
    );
  }

  if (
    target.step === 'goal' &&
    !questWordingRevisionStep(text, pendingStep) &&
    isVagueQuestGoal(goalStatement(text))
  ) {
    const reply = conversationalModelReply(model, text);
    return stay(
      replyAfterRetiredSuggestion(reply ?? QUEST_HELPER_OFFLINE_REPLY, false),
      'goal',
    );
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
  const decision = decideQuestDraftSuggestion({
    message: text,
    step: target.step,
    memberPatch: supplied,
    model,
  });
  if (decision.intent === 'propose') {
    const older =
      pending && Object.keys(pending.patch).length > 0 ? pending : null;
    if (older && !memberMessageReplacesPending(text, target.step)) {
      return stay(
        replyWhileOlderPending(
          conversationalModelReply(model, text) ?? QUEST_HELPER_OFFLINE_REPLY,
          older,
        ),
        currentStep,
        older,
      );
    }
    const requested = questEditRequestSection(text);
    const filed = questDraftPatchSection(decision.patch);
    if (requested && filed !== requested) {
      return stay(QUEST_EDIT_NOT_FILED_REPLY, requested);
    }
    return stay(
      replyForPendingSuggestion(
        conversationalModelReply(model, text),
        target.step,
        decision.patch,
      ),
      target.step,
      { step: target.step, patch: decision.patch },
    );
  }

  // Chat only. An older patch stays actionable when this message is not a
  // revision of it. A revision with no confirmable tool patch, or one whose
  // reply still needs a decision, retires that patch. Prose is not a replacement.
  const modelReply =
    conversationalModelReply(model, text) ?? QUEST_HELPER_OFFLINE_REPLY;
  const revising = questWordingRevisionStep(text, pendingStep);
  if (revising && pendingStep && revising === pendingStep) {
    return stay(
      replyAfterUnconfirmedRevision(modelReply, revising),
      revising,
      null,
    );
  }
  const actionable = Object.keys(pending?.patch ?? {}).length > 0;
  const chatReply =
    actionable && pending
      ? replyWhileOlderPending(modelReply, pending)
      : replyAfterRetiredSuggestion(modelReply, false);
  if (voice === 'saved' && !actionable && questEditRequestSection(text)) {
    const cleaned = replyWithoutUnbackedEditClaim(chatReply);
    return stay(cleaned || QUEST_EDIT_NOT_FILED_REPLY, target.step);
  }
  return stay(chatReply, actionable ? currentStep : target.step, pending);
}

/** Drop copies of the app's own notice so a reply carries it once, at the end. */
function withoutExactNotice(reply: string, notice: string): string {
  return reply
    .split(notice)
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .join('\n\n')
    .trim();
}

/**
 * The older patch stays. Every chat-only reply ends with that section's
 * notice, once. Model sentences do not decide whether yes still applies.
 */
const CONFLICTING_PENDING_CLAIM =
  /\b(?:nothing is waiting on a yes|no longer waiting|(?:suggestion|wording|it) is history|stays history|is history until|(?:has been|been|is|was) retired|still waiting on (?:your |a )?yes|nothing has been saved(?: yet)?|not saved yet)\b/i;

function replyWhileOlderPending(
  reply: string,
  pending: PendingQuestSectionProposal,
): string {
  const notice = questPendingYesNotice(pending.step);
  const withoutNotice = withoutExactNotice(reply, notice);
  const source = stripModelStateClaims(withoutNotice);
  const filtered = replyAfterRetiredSuggestion(source, false);
  const parts = filtered
    .split(/\n+|(?<=[.!?])\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0);
  const withoutClaims = parts.filter(
    (part) => !CONFLICTING_PENDING_CLAIM.test(part),
  );
  const unbacked = source.trim() !== withoutNotice.trim();
  const kept = unbacked
    ? withoutClaims.filter(
        (part) =>
          !/\btreat (?:those|these|this|that) words?\b/i.test(part) &&
          !/\bas a suggestion\b/i.test(part),
      )
    : withoutClaims;
  const cleaned =
    !unbacked && kept.length === parts.length
      ? filtered.trim()
      : kept.join('\n\n').trim();
  const body = withoutExactNotice(cleaned, notice);
  return body ? `${body}\n\n${notice}` : notice;
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
  voice = 'create',
}: {
  message: string;
  history?: readonly QuestDraftTurnHistoryItem[];
  viewerDisplayName: string;
  spaceMembers: readonly QuestSpaceMember[];
  readState: () => CreateDraftTurnSnapshot;
  isCurrent: () => boolean;
  loadModel: () => Promise<QuestDraftModelTurn | null>;
  voice?: 'create' | 'saved';
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
      voice,
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
