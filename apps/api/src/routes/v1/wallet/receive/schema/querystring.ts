import { Type, Static } from 'typebox';
import { chain } from '@schemas/chain';

export const querystring = Type.Object({
  tokenId: Type.Optional(
    Type.Integer({
      minimum: 0,
      description: 'Token ID',
    }),
  ),
  chain,
});

export type Querystring = Static<typeof querystring>;
