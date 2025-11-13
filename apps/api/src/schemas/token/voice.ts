import { Type, Static } from 'typebox';

export const voiceToken = Type.Object({
  name: Type.String(),
  symbol: Type.String(),
  balance: Type.Number(),
  percentage: Type.Number({ minimum: 0, maximum: 100 }),
  icon_url: Type.Union([Type.String({ format: 'uri' }), Type.Null()]),
});

export type VoiceToken = Static<typeof voiceToken>;
