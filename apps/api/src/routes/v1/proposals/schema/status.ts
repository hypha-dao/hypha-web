import { Static, Type } from 'typebox';

export const status = Type.Union([
  Type.Literal('active'),
  Type.Literal('past'),
]);

export type Status = Static<typeof status>;
