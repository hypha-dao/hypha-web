import { Type, Static } from 'typebox';

export const ownershipToken = Type.Object({
  name: Type.String(),
  symbol: Type.String(),
  balance: Type.Number(),
  percentage: Type.Number({
    minimum: 0,
    maximum: 100,
    description: 'Ownership share',
  }),
  icon_url: Type.Union([Type.String({ format: 'uri' }), Type.Null()]),
});

export type OwnershipToken = Static<typeof ownershipToken>;
