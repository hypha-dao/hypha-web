import { Type, Static } from 'typebox';
import { summary, commitment, payment } from '@schemas/proposal';

const response = {
  200: Type.Object({
    ...summary.properties,
    commitment: Type.Optional(commitment),
    payments: Type.Array(payment),
  }),
  '4xx': Type.Ref('HttpError'),
  '5xx': Type.Ref('HttpError'),
};

const params = Type.Object({
  id: Type.Integer({
    minimum: 0,
    description: 'Proposal ID',
  }),
});

export const schema = {
  params,
  response,
} as const;

export type Schema = {
  Reply: Static<(typeof response)[200]>;
  Params: Static<typeof params>;
};
