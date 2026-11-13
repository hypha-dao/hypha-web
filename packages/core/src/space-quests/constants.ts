export const QUEST_STATUSES = [
  'active',
  'proposed',
  'paused',
  'completed',
  'archived',
] as const;

export type QuestStatus = (typeof QUEST_STATUSES)[number];

/** Patchable statuses. Create is the only path to `proposed`. */
export const QUEST_PATCH_STATUSES = [
  'active',
  'paused',
  'completed',
  'archived',
] as const;

export type QuestPatchStatus = (typeof QUEST_PATCH_STATUSES)[number];

/** List view status filter (no Board, no Priority, no All/Health/Lead/Mine). */
export const QUEST_LIST_FILTERS = [
  'active',
  'proposed',
  'paused',
  'completed',
  'rejected',
] as const;

export type QuestListFilter = (typeof QUEST_LIST_FILTERS)[number];

export const QUEST_MILESTONE_STATUSES = [
  'not_started',
  'in_progress',
  'done',
] as const;

export type QuestMilestoneStatus = (typeof QUEST_MILESTONE_STATUSES)[number];

export const QUEST_HEALTH_STATES = [
  'on_track',
  'at_risk',
  'off_track',
] as const;

export type QuestHealthState = (typeof QUEST_HEALTH_STATES)[number];

export const QUEST_UPDATE_KINDS = ['post', 'edit_event', 'agent_post'] as const;

export type QuestUpdateKind = (typeof QUEST_UPDATE_KINDS)[number];

/** Canonical `documents.label` for Quest proposals in Agreements. */
export const QUEST_DOCUMENT_LABEL = 'Quest' as const;

/**
 * Visible quest fields. Draft save and create/patch share these caps.
 * Goal is sized for a long written brief. Scope, success criteria, and
 * responsibilities scale with it so a long quest can still name its work.
 */
export const QUEST_GOAL_LIMIT = 20_000;
export const QUEST_SCOPE_ITEM_LIMIT = 1_000;
export const QUEST_SCOPE_TEXT_LIMIT = 20_000;
export const QUEST_SUCCESS_CRITERIA_LIMIT = 20_000;
export const QUEST_RESPONSIBILITY_LIMIT = 800;

/**
 * Quest proposal body stored in `documents.description`.
 * Other agreement types stay on the shared 4000 character schema.
 * The stored body encodes the quest, so a 20,000 character goal is longer
 * than 20,000 once published. 32,000 covers that goal plus the usual lead,
 * scope, and participant fields.
 */
export const QUEST_PROPOSAL_DESCRIPTION_LIMIT = 32_000;

/** Default token symbols offered in Quest Reward selector. */
export const QUEST_DEFAULT_REWARD_TOKENS = [
  'USDC',
  'ETH',
  'HYPHA',
  'EURC',
] as const;

/** Dedicated coach in the new-quest chat. Not the shared “AI Agents” room. */
export const QUEST_HELPER_NAME = 'Quest Helper';

/**
 * Timeline id for that coach. It is not a Matrix user. A room event stamped
 * with this id is shown as the Quest Helper instead of AI Agents.
 */
export const QUEST_HELPER_AUTHOR_ID = 'quest-helper';

/** Guided Quest Steward section order (Goal first, one section per turn, no Priority). */
export const QUEST_STEWARD_STEPS = [
  'goal',
  'scope',
  'success',
  'milestones',
  'members',
  'lead',
  'targetDate',
  'rewards',
  'name',
] as const;

export type QuestStewardStep = (typeof QUEST_STEWARD_STEPS)[number];

export function isQuestStatus(value: unknown): value is QuestStatus {
  return (
    typeof value === 'string' &&
    (QUEST_STATUSES as readonly string[]).includes(value)
  );
}

export function isQuestListFilter(value: unknown): value is QuestListFilter {
  return (
    typeof value === 'string' &&
    (QUEST_LIST_FILTERS as readonly string[]).includes(value)
  );
}

export function isQuestMilestoneStatus(
  value: unknown,
): value is QuestMilestoneStatus {
  return (
    typeof value === 'string' &&
    (QUEST_MILESTONE_STATUSES as readonly string[]).includes(value)
  );
}

export function isQuestHealthState(value: unknown): value is QuestHealthState {
  return (
    typeof value === 'string' &&
    (QUEST_HEALTH_STATES as readonly string[]).includes(value)
  );
}
