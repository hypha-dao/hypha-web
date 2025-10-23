import { Static, Type } from 'typebox';

export const proposalType = Type.Union([
  Type.Literal('contribution'),
  Type.Literal('payment'),
  Type.Literal('funding'),
  Type.Literal('agreement'),
]);

export type ProposalType = Static<typeof proposalType>;
