import { Static, Type } from 'typebox';

export const label = Type.Enum([
  'contribution',
  'payment',
  'funding',
  'agreement',
]);

export type Label = Static<typeof label>;
