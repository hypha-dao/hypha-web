import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';

export default async function receiveRoutes(app: FastifyInstance) {
  app.get<Schema>('/', { schema }, async (request) => {});
}
