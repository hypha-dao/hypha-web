import type { QuestStewardStep } from './constants';

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
