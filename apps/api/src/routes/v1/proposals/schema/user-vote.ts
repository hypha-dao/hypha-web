import { Type, Static } from '@sinclair/typebox';

export const userVote = Type.Union([
  Type.Enum({
    yes: 'yes',
    no: 'no',
    viewed: 'viewed',
  }),
  Type.Null(),
]);

export type UserVote = Static<typeof userVote>;
