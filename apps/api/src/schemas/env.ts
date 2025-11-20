import { Type, Static } from 'typebox';

export const environment = Type.Object({
  PORT: Type.String({ default: '3001' }),
  DEFAULT_DB_URL: Type.String({
    description: 'Unauthenticated connection',
  }),
  DEFAULT_DB_ANONYMOUS_URL: Type.String({
    description: 'Authenticated connection without a token',
  }),
  DEFAULT_DB_AUTHENTICATED_URL: Type.String({
    description: 'Authenticated connection requiring a token',
  }),
  RPC_URL: Type.Optional(
    Type.String({
      description: 'HTTP endpoint to a JSON-RPC API of Ethereum',
    }),
  ),
  ALCHEMY_API_KEY: Type.Optional(Type.String()),
});

export type Environment = Static<typeof environment>;
