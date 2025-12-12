import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function pregenerateRoutes(app: FastifyInstance) {
  /**
   * @summary Add additional embedded wallets to users
   *          who already have Privy accounts
   * @see https://docs.privy.io/api-reference/users/pregenerate-wallets
   */
  app.post<Schema>('/', { schema }, async (_, reply) => {
    return reply.notImplemented();
  });
}
