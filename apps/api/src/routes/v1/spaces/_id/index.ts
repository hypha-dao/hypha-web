import type { FastifyInstance } from 'fastify';

export default async function spacesIdRoutes(app: FastifyInstance) {
  /**
   * @summary Get details of a space by its ID
   */
  app.get('/', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });
}
