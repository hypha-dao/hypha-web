import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
} from 'fastify';
import fp from 'fastify-plugin';
import { DbService } from './service';

export interface DbClientOptions extends FastifyPluginOptions {
  authenticatedUrl: string;
  anonymousUrl: string;
  defaultUrl: string;
}

const dbService: FastifyPluginAsync<DbClientOptions> = async (
  fastify: FastifyInstance,
  { authenticatedUrl, anonymousUrl, defaultUrl }: DbClientOptions,
) => {
  const db = new DbService(authenticatedUrl, anonymousUrl, defaultUrl);

  fastify.decorate('db', db);
};

export default fp(dbService);

declare module 'fastify' {
  interface FastifyInstance {
    db: DbService;
  }
}
