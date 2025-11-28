import { Type, Static } from 'typebox';
import { state, summary } from '@schemas/proposal';

export const getSchema = {
  querystring: Type.Object({
    dao_id: Type.Optional(Type.Integer({ minimum: 0 })),
    status: Type.Optional(state),
    limit: Type.Integer({ default: 20, minimum: 0, maximum: 100 }),
    offset: Type.Integer({ default: 0, minimum: 0 }),
  }),
  response: {
    200: Type.Object({
      data: Type.Array(summary),
      meta: Type.Object({
        total: Type.Integer(),
        limit: Type.Integer(),
        offset: Type.Integer(),
      }),
    }),
  },
} as const;

export const postSchema = {
  body: {},
  response: {},
} as const;

export type GetSchema = {
  Reply: Static<typeof getSchema.response>;
  Querystring: Static<typeof getSchema.querystring>;
};

export type PostSchema = {
  Body: Static<typeof postSchema.body>;
  Reply: Static<typeof postSchema.response>;
};
