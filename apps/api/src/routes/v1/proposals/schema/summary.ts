import { Type, Static } from '@sinclair/typebox';
import { proposalType } from './ptype';
import { status } from './status';
import { userVote } from './user-vote';
import { author } from './author';

export const summary = Type.Object({
  id: Type.Integer(),
  title: Type.String(),
  type: proposalType,
  image_url: Type.String({ format: 'uri' }),
  status: status,
  unity: Type.Integer(),
  quorum: Type.Integer(),
  user_vote: userVote,
  voting_deadline: Type.String({ format: 'date-time' }),
  author: author,
});

export type Summary = Static<typeof summary>;
