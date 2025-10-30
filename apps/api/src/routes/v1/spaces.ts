import { FastifyInstance } from 'fastify';

export default async function spacesRoutes(app: FastifyInstance) {
  /**
   * GET /spaces/:id
   */
  app.get('/:id', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /spaces
   */
  app.get('/', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });
}
