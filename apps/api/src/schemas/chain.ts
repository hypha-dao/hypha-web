import { Type, Static } from 'typebox';

export const chain = Type.Union([Type.Literal('base')], { default: 'base' });

export type Chain = Static<typeof chain>;
