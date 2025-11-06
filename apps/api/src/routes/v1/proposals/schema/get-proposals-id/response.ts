import { Type, Static } from 'typebox';
import { summary, commitment, payment } from '@schemas/proposal';

export const response = Type.Object({
  ...summary.properties,
  commitment: Type.Optional(commitment),
  payments: Type.Array(payment),
});

export type Response = Static<typeof response>;
