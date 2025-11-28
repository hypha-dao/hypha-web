import { Type, Static } from 'typebox';
import { chain } from '@schemas/chain';

export const response = Type.Object({
  network: chain,
  address: Type.String(),
  qr_code_url: Type.String({ format: 'uri' }),
});

export type Response = Static<typeof response>;
