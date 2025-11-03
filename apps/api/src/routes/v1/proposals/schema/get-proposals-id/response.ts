import { Type, Static } from 'typebox';
import { summary } from '../summary';
import { commitment } from '../commitment';
import { payment } from '../payment';

export const response = Type.Object({
  ...summary.properties,
  commitment: Type.Optional(commitment),
  payments: Type.Array(payment),
});

export type Response = Static<typeof response>;
