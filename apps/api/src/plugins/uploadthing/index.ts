import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
} from 'fastify';
import fp from 'fastify-plugin';
import { createRouteHandler } from 'uploadthing/fastify';
import { newUploadRouter, type uploadRouterParams } from './router';

export interface UploadthingOptions
  extends uploadRouterParams,
    FastifyPluginOptions {
  token: string;
}

const uploadthingHandler: FastifyPluginAsync<UploadthingOptions> = async (
  fastify: FastifyInstance,
  { token, ...routerParams }: UploadthingOptions,
) => {
  const router = newUploadRouter(routerParams);

  fastify.register(createRouteHandler, { router, config: { token } });
};

export default fp(uploadthingHandler);
