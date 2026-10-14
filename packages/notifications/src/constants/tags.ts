export const TAG_SUBSCRIBED = 'subscribed';
export const TAG_PUSH = 'push';
export const TAG_EMAIL = 'email';
export const TAG_MENTION_CONSENT = 'consent_mentions';
export const TAG_MEETING_CONSENT = 'consent_meetings';

export const TAG_SUB_OWN_ACTIONS = 'sub_ownActions';
export const TAG_SUB_SIGNALS = 'sub_signals';
export const TAG_SUB_NEW_PROPOSAL_OPEN = 'sub_newProposalOpen';
export const TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED =
  'sub_proposalApprovedOrRejected';

export const MAIN_TAGS = [
  TAG_SUBSCRIBED,
  TAG_PUSH,
  TAG_EMAIL,
  TAG_MENTION_CONSENT,
  TAG_MEETING_CONSENT,
  // Not in SUBSCRIPTION_TAGS until the Notification Centre exposes them (#2549 slice 3).
  TAG_SUB_OWN_ACTIONS,
  TAG_SUB_SIGNALS,
] as const;
export const SUBSCRIPTION_TAGS = [
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
] as const;
/** Written when a user switches a type/channel off. Absence of the tag means enabled (#2549 D4). */
export const TAG_VALUE_DISABLED = 'disabled';

/** Disabled = the `'disabled'` marker or the legacy explicit `'false'` opt-out. Absent / `'true'` = enabled. */
export function isTagDisabled(value: string | undefined): boolean {
  return value === TAG_VALUE_DISABLED || value === 'false';
}

export const TAGS = [...MAIN_TAGS, ...SUBSCRIPTION_TAGS] as const;

export type Tag = (typeof TAGS)[number];
export type MainTag = (typeof MAIN_TAGS)[number];
export type SubscriptionTag = (typeof SUBSCRIPTION_TAGS)[number];
