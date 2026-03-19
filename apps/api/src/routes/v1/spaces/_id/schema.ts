import { Type, type Static } from 'typebox';
import { summary } from '@schemas/space';

export const schema = {
  response: {
    200: summary,
    '4xx': Type.Ref('HttpError'),
    '5xx': Type.Ref('HttpError'),
  },
  params: Type.Object({
    id: Type.Integer({ minimum: 1, description: 'Space ID' }),
  }),
} as const;

export interface Schema {
  Reply: Static<(typeof schema.response)[200]>;
  Params: Static<typeof schema.params>;
}
