import { Type, Static } from 'typebox';
import { label } from './label';
import { state } from './state';
import { userVote } from './user-vote';
import { creator } from './creator';

export const summary = Type.Object({
  id: Type.Integer({ minimum: 0 }),
  title: Type.String(),
  description: Type.String(),
  label,
  image_URL: Type.String({ format: 'uri' }),
  state,
  unity: Type.Integer({ minimum: 0 }),
  quorum: Type.Integer({ minimum: 0 }),
  user_vote: userVote,
  voting_deadline: Type.String({ format: 'date-time' }),
  creatorId: Type.Integer(),
  creator,
  updatedAt: Type.String({ format: 'date-time' }),
  createdAt: Type.String({ format: 'date-time' }),
});

export type Summary = Static<typeof summary>;
