import { Type, Static } from 'typebox';

export const commitment = Type.Enum(['one_time', 'recurring']);

export type Commitment = Static<typeof commitment>;
