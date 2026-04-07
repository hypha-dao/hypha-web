import { Type, Static } from 'typebox';

export const summary = Type.Object({
  id: Type.Integer({ minimum: 0 }),
  name: Type.String(),
  description: Type.String(),
  cover_image_url: Type.Union([Type.String({ format: 'uri' }), Type.Null()]),
  icon_url: Type.Union([Type.String({ format: 'uri' }), Type.Null()]),
  members_count: Type.Integer({ minimum: 0 }),
  proposals_count: Type.Integer({ minimum: 0 }),
});

export type Summary = Static<typeof summary>;
