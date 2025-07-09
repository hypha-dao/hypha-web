import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  donutChartMock,
  areaChartMock,
  barChartMock,
  lineChartMock,
} from '../../mocks';

export default async function dashboardRoutes(app: FastifyInstance) {
  /**
   * GET /dashboard/donut-chart
   */
  app.get('/donut-chart', async (request, reply) => {
    const params = z.object({
      id: z.coerce.number().int(),
      range: z.enum(['1D', '1W', '1M', '6M', '1Y']).default('1M'),
    });
    const { id, range } = params.parse(request.query);

    return reply.send({ ...donutChartMock, id, range });
  });

  /**
   * GET /dashboard/area-chart
   */
  app.get('/area-chart', async (request, reply) => {
    const params = z.object({
      id: z.coerce.number().int(),
      range: z.enum(['1D', '1W', '1M', '6M', '1Y']).default('1M'),
      group_by: z
        .enum(['hour', '4hours', 'day', '4days', 'week', 'month'])
        .default('week'),
    });
    const { id, range, group_by } = params.parse(request.query);

    return reply.send({ ...areaChartMock, id, range, group_by });
  });

  /**
   * GET /dashboard/bar-chart
   */
  app.get('/bar-chart', async (request, reply) => {
    const params = z.object({
      id: z.coerce.number().int(),
      range: z.enum(['1D', '1W', '1M', '6M', '1Y']).default('1M'),
      group_by: z
        .enum(['hour', '4hours', 'day', '4days', 'week', 'month'])
        .default('week'),
    });
    const { id, range, group_by } = params.parse(request.query);

    return reply.send({ ...barChartMock, id, range, group_by });
  });

  /**
   * GET /dashboard/line-chart
   */
  app.get('/line-chart', async (request, reply) => {
    const params = z.object({
      id: z.coerce.number().int(),
      range: z.enum(['1D', '1W', '1M', '6M', '1Y']).default('1M'),
      group_by: z
        .enum(['hour', '4hours', 'day', '4days', 'week', 'month'])
        .default('week'),
    });
    const { id, range, group_by } = params.parse(request.query);

    return reply.send({ ...lineChartMock, id, range, group_by });
  });
}
