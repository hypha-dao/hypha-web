import { pgEnum } from 'drizzle-orm/pg-core';

export const governanceStateEnum = pgEnum('governance_state', [
  'discussion',
  'proposal',
  'agreement',
]);

export const voteTypeEnum = pgEnum('vote_type', ['yes', 'no', 'abstain']);

export const agreementStateEnum = pgEnum('agreement_state', [
  'accepted',
  'rejected',
]);
