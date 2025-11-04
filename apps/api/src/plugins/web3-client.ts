import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
} from 'fastify';
import fp from 'fastify-plugin';
import { createPublicClient, http } from 'viem';
import { type Chain, base } from 'viem/chains';

export interface Web3ClientOptions extends FastifyPluginOptions {
  rpcUrl?: string;
  multicallWait?: number;
  chain?: Chain;
}

const web3Client: FastifyPluginAsync<Web3ClientOptions> = async (
  fastify: FastifyInstance,
  { rpcUrl, chain = base, multicallWait = 100 }: Web3ClientOptions,
) => {
  const client = createPublicClient({
    batch: {
      multicall: { wait: multicallWait },
    },
    chain,
    transport: rpcUrl ? http(rpcUrl) : http(),
  });

  fastify.decorate('web3Client', client);
};

export default fp(web3Client);

declare module 'fastify' {
  interface FastifyInstance {
    web3Client: ReturnType<typeof createPublicClient>;
  }
}
