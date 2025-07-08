// apps/api/src/routes/v1/index.ts
import { FastifyInstance } from 'fastify';
import proposalsRoutes from './proposals';

export default async function v1Routes(app: FastifyInstance) {
  app.register(proposalsRoutes, { prefix: '/proposals' });
}
