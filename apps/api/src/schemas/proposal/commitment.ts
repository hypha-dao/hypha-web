import { Type, Static } from 'typebox';

export const commitment = Type.Union([
  Type.Literal('one_time'),
  Type.Literal('recurring'),
]);

export type Commitment = Static<typeof commitment>;
