import { Type, Static } from 'typebox';
import { chain } from '@schemas/chain';

export const response = {
  200: Type.Object({
    network: chain,
    address: Type.String(),
    qr_code_url: Type.String({ format: 'uri' }),
  }),
  '4xx': Type.Ref('HttpError'),
  '5xx': Type.Ref('HttpError'),
};

export type Response = Static<(typeof response)[200]>;
