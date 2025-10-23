import { Type, Static } from 'typebox';
import { proposalType } from './ptype';
import { status } from './status';
import { userVote } from './user-vote';
import { author } from './author';

export const summary = Type.Object({
  id: Type.Integer({ minimum: 0 }),
  title: Type.String(),
  type: proposalType,
  image_url: Type.String({ format: 'uri' }),
  status: status,
  unity: Type.Integer({ minimum: 0 }),
  quorum: Type.Integer({ minimum: 0 }),
  user_vote: userVote,
  voting_deadline: Type.String({ format: 'date-time' }),
  author: author,
});

export type Summary = Static<typeof summary>;
