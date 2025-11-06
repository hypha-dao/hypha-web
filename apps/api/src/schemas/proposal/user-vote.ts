import { Type, Static } from 'typebox';

export const userVote = Type.Union([
  Type.Literal('yes'),
  Type.Literal('no'),
  Type.Literal('viewed'),
  Type.Null(),
]);

export type UserVote = Static<typeof userVote>;
