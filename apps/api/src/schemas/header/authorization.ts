import { Type, Static } from 'typebox';

export const authorization = Type.Object({
  Authorization: Type.String({
    description: 'Is used to pass JWT to authorize the request',
    pattern: /Bearer \S+/,
  }),
});

export type Authorization = Static<typeof authorization>;
