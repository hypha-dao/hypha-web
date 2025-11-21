import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function tokenRoutes(app: FastifyInstance) {
  /**
   * @summary Fetches transactions of a user by specified token
   */
  app.get<Schema>('/:id', { schema }, async () => {
    // TODO
  });
}
