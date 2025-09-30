export const TAG_SUBSCRIBED = 'subscribed';
export const TAG_PUSH = 'push';
export const TAG_EMAIL = 'email';
export const TAG_NEW_PROPOSAL_OPEN = 'opt_newProposalOpen';
export const TAG_PROPOSAL_APPROVED_OR_REJECTED =
  'opt_proposalApprovedOrRejected';

export const MAIN_TAGS = [TAG_SUBSCRIBED, TAG_PUSH, TAG_EMAIL] as const;
export const OPTION_TAGS = [
  TAG_NEW_PROPOSAL_OPEN,
  TAG_PROPOSAL_APPROVED_OR_REJECTED,
] as const;
export const TAGS = [...MAIN_TAGS, ...OPTION_TAGS] as const;
export type Tag = (typeof TAGS)[number];
export type MainTag = (typeof MAIN_TAGS)[number];
export type OptionTag = (typeof OPTION_TAGS)[number];
