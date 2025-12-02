import { Type, Static } from 'typebox';
import { state, summary, label } from '@schemas/proposal';

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
  body: Type.Object({
    title: Type.String({ minLength: 1, maxLength: 50 }),
    description: Type.String({ minLength: 1, maxLength: 4000 }),
    spaceId: Type.Integer({ minimum: 0 }),
    creatorId: Type.Integer({ minimum: 0 }),
    leadImage: Type.Optional(Type.String({ format: 'url' })),
    attachments: Type.Optional(
      Type.Array(
        Type.Union([
          Type.Object({
            name: Type.String({ minLength: 1 }),
            url: Type.String({ format: 'url' }),
          }),
          Type.String({ format: 'url' }),
        ]),
        { maxItems: 3 },
      ),
    ),
    web3ProposalId: Type.Integer({ minimum: 0 }),
    slug: Type.Union([
      Type.String({
        minLength: 1,
        maxLength: 50,
        pattern: '^[a-z0-9-]+$',
      }),
      Type.Null(),
    ]),
    label: Type.Optional(label),
  }),
  response: {
    201: summary,
  },
} as const;

export type GetSchema = {
  Reply: Static<(typeof getSchema.response)[keyof typeof getSchema.response]>;
  Querystring: Static<typeof getSchema.querystring>;
};

export type PostSchema = {
  Body: Static<typeof postSchema.body>;
  Reply: Static<(typeof postSchema.response)[keyof typeof postSchema.response]>;
};
