import { Type, Static } from 'typebox';
import { utilityToken, voiceToken, ownershipToken } from '@schemas/token';

const response = {
  200: Type.Object({
    utility_tokens: Type.Array(utilityToken),
    voice_tokens: Type.Array(voiceToken),
    ownership_tokens: Type.Array(ownershipToken),
  }),
  '4xx': Type.Ref('HttpError'),
  '5xx': Type.Ref('HttpError'),
};

export const schema = {
  response,
} as const;

export type Schema = {
  Reply: Static<(typeof response)[200]>;
};
