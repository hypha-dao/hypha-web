import { Type, Static } from 'typebox';
import { utilityToken, voiceToken, ownershipToken } from '@schemas/token';

export const response = Type.Object({
  utility_tokens: Type.Array(utilityToken),
  voice_tokens: Type.Array(voiceToken),
  ownership_tokens: Type.Array(ownershipToken),
});

export type Response = Static<typeof response>;
