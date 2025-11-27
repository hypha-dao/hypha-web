// apps/api/src/routes/v1/index.ts
import { FastifyInstance } from 'fastify';
import proposalsRoutes from './proposals';
import dashboardRoutes from './dashboard';
import spacesRoutes from './spaces';
import walletRoutes from './wallet';
import autoload from '@fastify/autoload';
import { join } from 'node:path';

export default async function v1Routes(app: FastifyInstance) {
  app.register(proposalsRoutes, { prefix: '/proposals' });
  app.register(dashboardRoutes, { prefix: '/dashboard' });
  app.register(spacesRoutes, { prefix: '/spaces' });
  app.register(walletRoutes, { prefix: '/wallet' });

  app.register(autoload, {
    dir: join(__dirname, 'token'),
    options: { prefix: '/token' },
  });
}
