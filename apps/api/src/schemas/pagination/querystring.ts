import { Type, Static } from 'typebox';

export const querystring = Type.Object({
  limit: Type.Integer({ default: 20, minimum: 0, maximum: 100 }),
  offset: Type.Integer({ default: 0, minimum: 0 }),
});

export type Querystring = Static<typeof querystring>;
