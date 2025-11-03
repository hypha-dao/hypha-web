import { FastifyInstance } from 'fastify';

export default async function dashboardRoutes(app: FastifyInstance) {
  /**
   * GET /dashboard/donut-chart
   */
  app.get('/donut-chart', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /dashboard/area-chart
   */
  app.get('/area-chart', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /dashboard/bar-chart
   */
  app.get('/bar-chart', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });

  /**
   * GET /dashboard/line-chart
   */
  app.get('/line-chart', async (_, reply) => {
    return reply.code(500).send({ message: 'Not implemented yet' });
  });
}
