// apps/api/src/routes/v1/index.ts
import { FastifyInstance } from 'fastify';
import proposalsRoutes from './proposals';
import dashboardRoutes from './dashboard';
import spacesRoutes from './spaces';
import walletRoutes from './wallet';

export default async function v1Routes(app: FastifyInstance) {
  app.register(proposalsRoutes, { prefix: '/proposals' });
  app.register(dashboardRoutes, { prefix: '/dashboard' });
  app.register(spacesRoutes, { prefix: '/spaces' });
  app.register(walletRoutes, { prefix: '/wallet' });
}
