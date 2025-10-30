import { Type, Static } from 'typebox';
import { state } from '@schemas/proposal';

export const query = Type.Object({
  dao_id: Type.Optional(Type.Integer({ minimum: 0 })),
  status: Type.Optional(state),
  limit: Type.Integer({ default: 20, minimum: 0, maximum: 100 }),
  offset: Type.Integer({ default: 0, minimum: 0 }),
});

export type Query = Static<typeof query>;
