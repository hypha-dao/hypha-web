import 'server-only';

import { createPublicClient, fallback, http } from 'viem';
import { base } from 'viem/chains';

/**
 * Server-side viem public client used by API routes.
 *
 * Transport selection prefers a server-only RPC and falls through to other
 * configured endpoints with the public Base RPC as a last resort. This avoids
 * 5xx-ing API routes whenever the public endpoint throttles — a recurring
 * cause of "Failed to verify access" / "Failed to fetch space energy data".
 *
 * Resolution order:
 *  1. `RPC_URL`             — server-only, e.g. Alchemy/Infura with secret key
 *  2. `NEXT_PUBLIC_RPC_URL` — also configured for client bundles; usable on
 *                             the server when no server-only key is set
 *  3. `https://mainnet.base.org` — always-available public default
 */
const buildTransport = () => {
  const transports = [] as ReturnType<typeof http>[];
  if (process.env.RPC_URL) {
    transports.push(http(process.env.RPC_URL));
  }
  if (
    process.env.NEXT_PUBLIC_RPC_URL &&
    process.env.NEXT_PUBLIC_RPC_URL !== process.env.RPC_URL
  ) {
    transports.push(http(process.env.NEXT_PUBLIC_RPC_URL));
  }
  transports.push(http('https://mainnet.base.org'));
  return transports.length === 1 ? transports[0]! : fallback(transports);
};

export const web3Client = createPublicClient({
  batch: {
    multicall: { wait: 100 },
  },
  chain: base,
  transport: buildTransport(),
});
