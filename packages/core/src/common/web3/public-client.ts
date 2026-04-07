import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

/**
 * @deprecated Insecure. Use server-side version instead
 */
export const publicClient = createPublicClient({
  batch: {
    multicall: { wait: 100 },
  },
  chain: base,
  transport: process.env.NEXT_PUBLIC_RPC_URL
    ? http(process.env.NEXT_PUBLIC_RPC_URL)
    : http(),
});
