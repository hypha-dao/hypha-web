import { createPublicClient, fallback, http, type PublicClient } from 'viem';
import { base } from 'viem/chains';

/**
 * @deprecated Insecure. Use server-side version instead
 */
export const publicClient: PublicClient = createPublicClient({
  batch: {
    multicall: { wait: 100 },
  },
  chain: base,
  transport: process.env.NEXT_PUBLIC_RPC_URL
    ? fallback([
        http(process.env.NEXT_PUBLIC_RPC_URL),
        http('https://mainnet.base.org'),
      ])
    : http('https://mainnet.base.org'),
});
