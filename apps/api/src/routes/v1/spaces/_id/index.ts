import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function spacesIdRoutes(app: FastifyInstance) {
  /**
   * @summary Get details of a space by its ID
   */
  app.get<Schema>('/', { schema }, async (_, reply) => {
    return reply.internalServerError('Not implemented yet');
  });
}
