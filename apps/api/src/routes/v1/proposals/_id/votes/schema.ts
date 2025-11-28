import { Type, Static } from 'typebox';
import { userVote } from '@schemas/proposal';

export const params = Type.Object({
  id: Type.Integer({
    minimum: 0,
    description: 'Proposal ID',
  }),
});

export const query = Type.Object({
  limit: Type.Integer({ default: 20, minimum: 0, maximum: 100 }),
  offset: Type.Integer({ default: 0, minimum: 0 }),
});

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

export const schema = {
  params,
  querystring: query,
  response: { 200: response },
} as const;

export type Schema = {
  Reply: Static<typeof response>;
  Params: Static<typeof params>;
  Querystring: Static<typeof query>;
};
