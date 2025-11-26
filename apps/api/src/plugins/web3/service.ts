import { createPublicClient, http } from 'viem';
import { type Chain, base } from 'viem/chains';

export class Web3Service {
  private readonly client;

  constructor({
    rpcUrl,
    multicallWait = 100,
    chain = base,
  }: {
    rpcUrl?: string;
    multicallWait?: number;
    chain?: Chain;
  }) {
    this.client = createPublicClient({
      batch: {
        multicall: { wait: multicallWait },
      },
      chain,
      transport: http(rpcUrl),
    });
  }

  // TODO: methods
}
