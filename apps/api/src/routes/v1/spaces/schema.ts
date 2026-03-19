import { Type, type Static } from 'typebox';
import { summary } from '@schemas/space';

export const schema = {
  response: {
    200: Type.Array(summary),
    '4xx': Type.Ref('HttpError'),
    '5xx': Type.Ref('HttpError'),
  },
} as const;

export interface Schema {
  Reply: Static<(typeof schema.response)[200]>;
}
