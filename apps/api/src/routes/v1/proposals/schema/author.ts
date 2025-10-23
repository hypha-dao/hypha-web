import { Type, Static } from 'typebox';

export const author = Type.Object({
  username: Type.String(),
  reference: Type.String(),
  avatar_url: Type.String({ format: 'uri' }),
});

export type Author = Static<typeof author>;
