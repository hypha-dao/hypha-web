import { Static, Type } from 'typebox';

export const label = Type.Union([
  Type.Literal('contribution'),
  Type.Literal('payment'),
  Type.Literal('funding'),
  Type.Literal('agreement'),
]);

export type Label = Static<typeof label>;
