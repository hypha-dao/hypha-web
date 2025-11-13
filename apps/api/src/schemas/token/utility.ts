import { Type, Static } from 'typebox';

export const utilityToken = Type.Object({
  name: Type.String(),
  symbol: Type.String(),
  balance: Type.Number(),
  icon_url: Type.Union([Type.String({ format: 'uri' }), Type.Null()]),
});

export type UtilityToken = Static<typeof utilityToken>;
