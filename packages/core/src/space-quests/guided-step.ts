import type { QuestStewardStep } from './constants';

export type QuestDraftTarget = {
  /** Section this message is allowed to write. */
  step: QuestStewardStep;
  /** Asked to fill every section. Write nothing and stay put. */
  bulk: boolean;
};

const SECTION_NAME =
  '(success\\s+criteria|in[-\\s]?scope|out[-\\s]of[-\\s]?scope|milestones?|members?|target\\s+date|quest\\s+rewards?|rewards?|quest\\s+name|scope|success|lead|goal|name|title)';

/** "Focus only on Scope", "help me with the Scope section", "tighten the in-scope". */
const NAMED_SECTION = new RegExp(
  `(?:focus(?:\\s+only)?\\s+on|only\\s+on|help(?:\\s+me)?\\s+with(?:\\s+the)?|tighten(?:\\s+the)?|just(?:\\s+the)?|(?:draft|fill|write|update|revise)\\s+(?:the\\s+)?)\\s*(?:the\\s+)?${SECTION_NAME}\\b`,
  'i',
);

const SECTION_LABEL = new RegExp(
  `\\b${SECTION_NAME}\\s+section(?:\\s+only)?\\b`,
  'i',
);

/** "Now let's define the scope" — name the section without writing it. */
const SECTION_NAV = new RegExp(
  `\\b(?:define|talk about|work on|move on to|start on|cover|about)\\s+(?:the\\s+)?${SECTION_NAME}\\b|\\bwhat(?: is|['\\u2019]s)\\b[\\s\\S]{0,40}\\b${SECTION_NAME}\\b`,
  'i',
);

/** "Please propose these as Milestones" — the section is named, not implied. */
const ADDRESSED_SECTION = new RegExp(
  `\\b(?:as|into)\\s+(?:the\\s+)?${SECTION_NAME}\\b`,
  'i',
);

const MILESTONE_COUNT = 'one|two|three|four|five|six|seven|eight|nine|ten|\\d+';

const MILESTONE_MONTH =
  'January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec';

function stepFromSectionName(raw: string): QuestStewardStep | null {
  const name = raw.toLowerCase().replace(/\s+/g, ' ').trim();
  if (name.includes('scope')) return 'scope';
  if (name.includes('success')) return 'success';
  if (name.includes('milestone')) return 'milestones';
  if (name.includes('member')) return 'members';
  if (name.includes('target date')) return 'targetDate';
  if (name.includes('reward')) return 'rewards';
  if (name.includes('name') || name.includes('title')) return 'name';
  if (name === 'lead') return 'lead';
  if (name.includes('goal')) return 'goal';
  return null;
}

function mentionsSeveralSections(text: string): boolean {
  const lower = text.toLowerCase();
  let count = 0;
  if (/\bscope\b/.test(lower)) count += 1;
  if (/\b(success|criteria)\b/.test(lower)) count += 1;
  if (/\bmilestones?\b/.test(lower)) count += 1;
  if (/\bmembers?\b/.test(lower)) count += 1;
  if (/\brewards?\b/.test(lower)) count += 1;
  return count >= 2;
}

/** "Draft everything" or "draft the scope, success criteria, and milestones". */
export function isBulkQuestDraftRequest(text: string): boolean {
  const lower = text.toLowerCase();
  const asksToDraft =
    /\b(draft|suggest|propose|auto[- ]?fill|fill(?:\s+in|\s+out)?|generate|write)\b/.test(
      lower,
    );
  if (!asksToDraft) return false;
  if (
    /\b(everything|all sections|all of the sections|every section|the whole quest|all of it|the rest|sections)\b/.test(
      lower,
    )
  ) {
    return true;
  }
  if (/\b(draft|fill|generate|suggest|propose|write)\s+all\b/.test(lower)) {
    return true;
  }
  if (/\bonly\b/.test(lower) || /\bfocus\b/.test(lower)) return false;
  return mentionsSeveralSections(lower);
}

function explicitSectionName(text: string): string | undefined {
  return (
    NAMED_SECTION.exec(text)?.[1] ??
    SECTION_LABEL.exec(text)?.[1] ??
    SECTION_NAV.exec(text)?.[1] ??
    ADDRESSED_SECTION.exec(text)?.[1]
  );
}

/**
 * A field label, not a passing mention: "In scope:", "Success criteria:", "Lead:".
 * The earliest label wins when a message names more than one section.
 */
const LABELED_SECTION_PATTERNS: ReadonlyArray<{
  pattern: RegExp;
  step: QuestStewardStep;
}> = [
  {
    pattern:
      /\b(?:in[-\s]+scope|out[-\s]+of[-\s]+scope|scope[-\s]+in|scope[-\s]+out)\s*:/i,
    step: 'scope',
  },
  {
    pattern: /(?:^|[\n.;])\s*in\s*:\s*\S[\s\S]*?(?:^|[\n.;])\s*out\s*:/i,
    step: 'scope',
  },
  {
    pattern: /(?:^|[\n.])\s*success(?:\s+criteria)?\s*:/i,
    step: 'success',
  },
  {
    pattern: /(?:^|[\n.])\s*milestones?\s*:/i,
    step: 'milestones',
  },
  {
    pattern: /(?:^|[\n.])\s*members?\s*:/i,
    step: 'members',
  },
  {
    pattern: /(?:^|[\n.])\s*lead\s*:/i,
    step: 'lead',
  },
  {
    pattern: /(?:^|[\n.])\s*target(?:\s+date)?\s*:/i,
    step: 'targetDate',
  },
  {
    pattern: /(?:^|[\n.])\s*(?:quest\s+)?rewards?\s*:/i,
    step: 'rewards',
  },
  {
    pattern: /(?:^|[\n.])\s*goal\s*:/i,
    step: 'goal',
  },
  {
    pattern: /(?:^|[\n.])\s*(?:quest\s+name|quest\s+title|name|title)\s*:/i,
    step: 'name',
  },
];

function labeledSectionStep(text: string): QuestStewardStep | null {
  let best: { index: number; step: QuestStewardStep } | null = null;
  for (const { pattern, step } of LABELED_SECTION_PATTERNS) {
    const match = pattern.exec(text);
    if (match == null) continue;
    if (!best || match.index < best.index) {
      best = { index: match.index, step };
    }
  }
  return best?.step ?? null;
}

function lineHasCalendarDate(line: string): boolean {
  return new RegExp(
    `\\b\\d{1,2}\\s*(?:${MILESTONE_MONTH})\\s*\\d{4}\\b|\\b(?:${MILESTONE_MONTH})\\s*\\d{1,2},?\\s*\\d{4}\\b|\\b\\d{4}-\\d{2}-\\d{2}\\b`,
    'i',
  ).test(line);
}

/**
 * A milestone list, not a passing mention of the word.
 * "Exactly 3 milestones: M1 …", two M-labels, or dash lines of title - date - owner.
 */
function messageTargetsMilestones(text: string): boolean {
  if ((text.match(/\bM\d+\b/gi) ?? []).length >= 2) return true;
  if (
    new RegExp(
      `\\b(?:exactly|only|just)\\s+(?:${MILESTONE_COUNT})\\s+milestones?\\b|\\b(?:${MILESTONE_COUNT})\\s+milestones?\\s*:|^\\s*milestones?\\s*:`,
      'im',
    ).test(text)
  ) {
    return true;
  }
  const datedDashLines = text
    .split(/\n+|;\s*/)
    .map((line) => line.trim())
    .filter((line) => /\s[-–—]\s/.test(line) && lineHasCalendarDate(line));
  return datedDashLines.length >= 2;
}

/**
 * The section a new-quest message may write.
 * A named section or a labeled payload wins over the tracker, which may
 * already have moved on. Milestone-shaped content does too.
 * A bulk "draft everything" request writes no section.
 */
export function resolveQuestDraftTarget(
  message: string,
  currentStep: QuestStewardStep,
): QuestDraftTarget {
  const text = message.trim();
  if (!text) return { step: currentStep, bulk: false };
  if (isBulkQuestDraftRequest(text)) return { step: currentStep, bulk: true };
  const named = explicitSectionName(text);
  const namedStep = named ? stepFromSectionName(named) : null;
  if (namedStep) return { step: namedStep, bulk: false };
  const labeled = labeledSectionStep(text);
  if (labeled) return { step: labeled, bulk: false };
  if (messageTargetsMilestones(text)) {
    return { step: 'milestones', bulk: false };
  }
  return { step: currentStep, bulk: false };
}

const QUEST_STEP_PATCH_KEYS: Record<QuestStewardStep, readonly string[]> = {
  goal: ['goal'],
  scope: ['scopeIn', 'scopeOut'],
  success: ['successCriteriaBullets'],
  milestones: ['milestones'],
  members: ['members'],
  lead: ['leadName'],
  targetDate: ['targetDate'],
  rewards: ['rewards'],
  name: ['name'],
};

/**
 * Keep only the fields for the section the Quest Helper is coaching.
 * A goal answer must not also write scope, milestones, or rewards.
 */
export function limitQuestPatchToStep<T extends object>(
  patch: T,
  step: QuestStewardStep,
): Partial<T> {
  const allowed = new Set<string>(QUEST_STEP_PATCH_KEYS[step]);
  const next: Partial<T> = {};
  for (const key of Object.keys(patch) as (keyof T)[]) {
    if (!allowed.has(key as string)) continue;
    const value = patch[key];
    if (value == null) continue;
    if (typeof value === 'string' && value.trim().length === 0) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    next[key] = value;
  }
  return next;
}
