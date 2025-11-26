import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
} from 'fastify';
import fp from 'fastify-plugin';
import type { Chain } from 'viem/chains';
import { Web3Service } from './service';

export interface Web3ClientOptions extends FastifyPluginOptions {
  rpcUrl?: string;
  multicallWait?: number;
  chain?: Chain;
}

const web3Client: FastifyPluginAsync<Web3ClientOptions> = async (
  fastify: FastifyInstance,
  options: Web3ClientOptions,
) => {
  const client = new Web3Service(options);

  fastify.decorate('web3', client);
};

export default fp(web3Client);

declare module 'fastify' {
  interface FastifyInstance {
    web3: Web3Service;
  }
}
