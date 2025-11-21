import { Type, Static } from 'typebox';
import { ownershipToken, utilityToken, voiceToken } from '@schemas/token';
import { body } from '@schemas/trx';

const transactions = Type.Array(body);

export const response = Type.Union([
  Type.Object({ ...ownershipToken.properties, transactions }),
  Type.Object({ ...utilityToken.properties, transactions }),
  Type.Object({ ...voiceToken.properties, transactions }),
]);

export type Response = Static<typeof response>;
