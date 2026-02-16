import { Static, Type } from 'typebox';

export const state = Type.Enum(['active', 'past']);

export type State = Static<typeof state>;
