import { FastifyInstance } from 'fastify';

export default async function walletRoutes(app: FastifyInstance) {
  /**
   * GET /wallet/receive
   */
  app.get('/receive', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * POST /wallet/send
   */
  app.post('/send', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /wallet/recipients
   */
  app.get('/recipients', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /wallet/tokens/:id
   */
  app.get('/tokens/:id', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /wallet
   */
  app.get('/', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });
}
