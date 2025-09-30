import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { spaceMock } from '../../mocks';

export default async function spacesRoutes(app: FastifyInstance) {
  /**
   * GET /spaces/:id
   */
  app.get('/:id', async (request, reply) => {
    const { id } = z.object({ id: z.coerce.number() }).parse(request.params);

    return reply.send({ ...spaceMock, id });
  });

  /**
   * GET /spaces
   */
  app.get('/', async (_, reply) => {
    return reply.send([spaceMock]);
  });
}
