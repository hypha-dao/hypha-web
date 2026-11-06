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

/**
 * The section a new-quest message may write.
 * A named section wins over the tracker, which may already have moved on.
 * A bulk "draft everything" request writes no section.
 */
export function resolveQuestDraftTarget(
  message: string,
  currentStep: QuestStewardStep,
): QuestDraftTarget {
  const text = message.trim();
  if (!text) return { step: currentStep, bulk: false };
  if (isBulkQuestDraftRequest(text)) return { step: currentStep, bulk: true };
  const named = NAMED_SECTION.exec(text)?.[1] ?? SECTION_LABEL.exec(text)?.[1];
  const step = named ? stepFromSectionName(named) : null;
  return { step: step ?? currentStep, bulk: false };
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
