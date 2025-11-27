import { Type, Static } from 'typebox';

const recipient = Type.Object({
  username: Type.String(),
  avatar_url: Type.Union([Type.String({ format: 'uri' }), Type.Null()]),
  address: Type.String(),
});

export const response = Type.Object({
  recipients: Type.Array(recipient),
});

export type Response = Static<typeof response>;
