import { Type, Static } from 'typebox';

export const environment = Type.Object({
  PORT: Type.String({ default: '3001' }),
  DEFAULT_DB_URL: Type.String(),
  DEFAULT_DB_AUTHENTICATED_URL: Type.String(),
  DEFAULT_DB_ANONYMOUS_URL: Type.String(),
  RPC_URL: Type.Optional(
    Type.String({
      description: 'HTTP endpoint to a JSON-RPC API',
    }),
  ),
  ALCHEMY_API_KEY: Type.String(),
});

export type Environment = Static<typeof environment>;
