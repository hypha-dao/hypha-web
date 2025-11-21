import { Type, Static } from 'typebox';

export const body = Type.Object({
  username: Type.String(),
  avatar_url: Type.Union([Type.String({ format: 'uri' }), Type.Null()]),
  direction: Type.Union([Type.Literal('income'), Type.Literal('payment')]),
  amount: Type.Number(),
  symbol: Type.String(),
  timestamp: Type.String({
    format: 'date-time',
  }),
});

export type Body = Static<typeof body>;
