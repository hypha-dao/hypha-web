import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
} from 'fastify';
import fp from 'fastify-plugin';
import { Alchemy, type AlchemySettings } from 'alchemy-sdk';
import { newGetTokenBalanceByAddress } from './token-balance-by-address';

export interface AlchemyClientOptions
  extends AlchemySettings,
    FastifyPluginOptions {}

const alchemyClient: FastifyPluginAsync<AlchemyClientOptions> = async (
  fastify: FastifyInstance,
  config: AlchemyClientOptions,
) => {
  const client = new Alchemy(config);

  const getTokenBalanceByAddress = newGetTokenBalanceByAddress(client);

  fastify.decorate('alchemy', { getTokenBalanceByAddress });
};

export default fp(alchemyClient);

declare module 'fastify' {
  interface FastifyInstance {
    alchemy: {
      getTokenBalanceByAddress: ReturnType<typeof newGetTokenBalanceByAddress>;
    };
  }
}
