import { Type, Static } from 'typebox';

export const userVote = Type.Union([
  Type.String({
    enum: ['yes', 'no', 'viewed'],
  }),
  Type.Null(),
]);

export type UserVote = Static<typeof userVote>;
