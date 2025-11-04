import { Type, Static } from 'typebox';
import { summary } from '../summary';

export const response = Type.Object({
  data: Type.Array(summary),
  meta: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type Response = Static<typeof response>;
