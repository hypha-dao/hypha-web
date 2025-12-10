import type { FastifyInstance } from 'fastify';
import { schema, type Schema } from './schema';
import ratelimit from '@fastify/rate-limit';

export default async function spacesRoutes(app: FastifyInstance) {
  await app.register(ratelimit, {
    global: false,
    max: 100,
    timeWindow: '1 minute',
  });

  /**
   * @summary Get spaces by a user
   */
  app.get<Schema>(
    '/',
    {
      schema,
      config: {
        rateLimit: { max: 100, timeWindow: '1 minute' },
      },
    },
  }, async (_, reply) => {
    return reply.notImplemented();
  });
}
