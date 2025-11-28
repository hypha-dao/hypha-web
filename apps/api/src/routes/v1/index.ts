// apps/api/src/routes/v1/index.ts
import { FastifyInstance } from 'fastify';
import { join } from 'node:path';
import autoload from '@fastify/autoload';
import dashboardRoutes from './dashboard';
import spacesRoutes from './spaces';
import walletRoutes from './wallet';

export default async function v1Routes(app: FastifyInstance) {
  app.register(autoload, {
    dir: join(__dirname, 'proposals'),
    routeParams: true,
    options: { prefix: '/proposals' },
  });
  app.register(dashboardRoutes, { prefix: '/dashboard' });
  app.register(spacesRoutes, { prefix: '/spaces' });
  app.register(walletRoutes, { prefix: '/wallet' });
}
