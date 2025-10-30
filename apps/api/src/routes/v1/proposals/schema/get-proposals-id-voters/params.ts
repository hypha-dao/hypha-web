import { Type, Static } from 'typebox';

export const params = Type.Object({
  id: Type.Integer({
    minimum: 0,
    description: 'Proposal ID',
  }),
});

export type Params = Static<typeof params>;
