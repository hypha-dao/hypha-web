import type { FastifyInstance, FastifyPluginAsync } from 'fastify';
import fp from 'fastify-plugin';
import { PrivyClient } from '@privy-io/node';

export interface PrivyClientOptions {
  appId: string;
  appSecret: string;
}

const privyClient: FastifyPluginAsync<PrivyClientOptions> = async (
  fastify: FastifyInstance,
  { appId, appSecret }: PrivyClientOptions,
) => {
  fastify.decorate('privy', new PrivyClient({ appId, appSecret }));
};

export default fp(privyClient);

declare module 'fastify' {
  interface FastifyInstance {
    privy: PrivyClient;
  }
}
