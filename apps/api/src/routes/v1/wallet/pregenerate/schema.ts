import { Type, Static } from 'typebox';

export const body = Type.Object({
  userId: Type.String({ description: 'User ID from Privy' }),
});

export const successfulResponse = Type.Object({
  userId: Type.String({ description: 'User ID from Privy' }),
});

export const response = {
  200: successfulResponse,
  '4xx': Type.Ref('HttpError'),
  '5xx': Type.Ref('HttpError'),
};

export const schema = {
  response,
  body,
} as const;

export interface Schema {
  Reply: Static<typeof successfulResponse>;
  Body: Static<typeof body>;
}
