export const TAG_SUBSCRIBED = 'subscribed';
export const TAG_PUSH = 'push';
export const TAG_EMAIL = 'email';

export const TAG_SUB_NEW_PROPOSAL_OPEN = 'sub_newProposalOpen';
export const TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED =
  'sub_proposalApprovedOrRejected';

export const MAIN_TAGS = [TAG_SUBSCRIBED, TAG_PUSH, TAG_EMAIL] as const;
export const SUBSCRIPTION_TAGS = [
  TAG_SUB_NEW_PROPOSAL_OPEN,
  TAG_SUB_PROPOSAL_APPROVED_OR_REJECTED,
] as const;
export const TAGS = [...MAIN_TAGS, ...SUBSCRIPTION_TAGS] as const;

export type Tag = (typeof TAGS)[number];
export type MainTag = (typeof MAIN_TAGS)[number];
export type SubscriptionTag = (typeof SUBSCRIPTION_TAGS)[number];
