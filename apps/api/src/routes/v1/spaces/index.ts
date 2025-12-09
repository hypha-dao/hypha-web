import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function spacesRoutes(app: FastifyInstance) {
  /**
   * @summary Get spaces by a user
   */
  app.get<Schema>('/', { schema }, async (_, reply) => {
    return reply.notImplemented();
  });
}
