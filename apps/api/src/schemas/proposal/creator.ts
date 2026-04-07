import { Type, Static } from 'typebox';

export const creator = Type.Object({
  name: Type.String(),
  surname: Type.String(),
  avatarUrl: Type.String({ format: 'uri' }),
});

export type Creator = Static<typeof creator>;
