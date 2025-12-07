import type { FastifyInstance } from 'fastify';

export default async function spacesRoutes(app: FastifyInstance) {
  /**
   * @summary Get spaces by a user
   */
  app.get('/', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });
}
