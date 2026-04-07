import { Type, Static } from 'typebox';
import { ownershipToken, utilityToken, voiceToken } from '@schemas/token';
import { body } from '@schemas/trx';

const transactions = Type.Array(body);

export const response = {
  200: Type.Union([
    Type.Object({ ...ownershipToken.properties, transactions }),
    Type.Object({ ...utilityToken.properties, transactions }),
    Type.Object({ ...voiceToken.properties, transactions }),
  ]),
  '4xx': Type.Ref('HttpError'),
  '5xx': Type.Ref('HttpError'),
};

export type Response = Static<(typeof response)[200]>;
