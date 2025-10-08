import { Static, Type } from '@sinclair/typebox';

export const proposalType = Type.Enum({
  contribuition: 'contribuition',
  payment: 'payment',
  funding: 'funding',
  agreement: 'agreement',
});

export type ProposalType = Static<typeof proposalType>;
