import { Type, Static } from 'typebox';
import { summary } from '@schemas/proposal';

export const response = Type.Object({
  data: Type.Array(summary),
  meta: Type.Object({
    total: Type.Integer(),
    limit: Type.Integer(),
    offset: Type.Integer(),
  }),
});

export type Response = Static<typeof response>;
