// apps/api/src/routes/v1/index.ts
import { FastifyInstance } from 'fastify';
import proposalsRoutes from './proposals';
import dashboardRoutes from './dashboard';

export default async function v1Routes(app: FastifyInstance) {
  app.register(proposalsRoutes, { prefix: '/proposals' });
  app.register(dashboardRoutes, { prefix: '/dashboard' });
}
