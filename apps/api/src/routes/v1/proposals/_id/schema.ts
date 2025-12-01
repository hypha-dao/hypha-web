import { Type, Static } from 'typebox';
import { summary, commitment, payment } from '@schemas/proposal';

const response = Type.Object({
  ...summary.properties,
  commitment: Type.Optional(commitment),
  payments: Type.Array(payment),
});

const params = Type.Object({
  id: Type.Integer({
    minimum: 0,
    description: 'Proposal ID',
  }),
});

export const schema = {
  params,
  response: { 200: response },
} as const;

export type Schema = {
  Reply: Static<typeof response>;
  Params: Static<typeof params>;
};
