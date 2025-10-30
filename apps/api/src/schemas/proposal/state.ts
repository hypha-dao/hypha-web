import { Static, Type } from 'typebox';

export const state = Type.Union([Type.Literal('active'), Type.Literal('past')]);

export type State = Static<typeof state>;
