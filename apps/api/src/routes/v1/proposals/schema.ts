import { Type, Static } from 'typebox';
import { state } from '@schemas/proposal';
import { summary } from '@schemas/proposal';

export const query = Type.Object({
  dao_id: Type.Optional(Type.Integer({ minimum: 0 })),
  status: Type.Optional(state),
  limit: Type.Integer({ default: 20, minimum: 0, maximum: 100 }),
  offset: Type.Integer({ default: 0, minimum: 0 }),
});

export const response = Type.Object({
  data: Type.Array(summary),
  meta: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export const schema = {
  querystring: query,
  response: { 200: response },
} as const;

export type Schema = {
  Reply: Static<typeof response>;
  Querystring: Static<typeof query>;
};
