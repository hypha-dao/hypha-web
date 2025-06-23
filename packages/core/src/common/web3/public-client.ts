import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

export const publicClient = createPublicClient({
  batch: {
    multicall: { wait: 100 },
  },
  chain: base,
  transport: http(process.env.NEXT_PUBLIC_RPC_URL),
});
