import { Type, Static } from 'typebox';

export const payment = Type.Object({
  amount: Type.Number({ minimum: 0 }),
  token: Type.String(),
  payment_request: Type.Union([Type.String(), Type.Null()]),
});

export type Payment = Static<typeof payment>;
