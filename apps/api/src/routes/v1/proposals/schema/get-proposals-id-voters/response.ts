import { Type, Static } from 'typebox';
import { userVote } from '@schemas/proposal';

const voter = Type.Object({
  name: Type.String(),
  surname: Type.String(),
  avatarUrl: Type.Union([Type.String({ format: 'uri' }), Type.Null()]),
  vote: userVote,
  address: Type.String(),
  timestamp: Type.Union([Type.String({ format: 'date-time' }), Type.Null()]),
});

export const response = Type.Object({
  voters: Type.Array(voter),
  meta: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type Response = Static<typeof response>;
