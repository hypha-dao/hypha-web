import 'server-only';

import { createPublicClient, fallback, http, type PublicClient } from 'viem';
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
const buildTransports = () => {
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
  return transports;
};

/**
 * Typed as `PublicClient` so consumers (and project references) don't need to
 * resolve viem internals like `FallbackTransport` — the inferred type leaks
 * those paths and breaks `tsc --noEmit` for downstream packages.
 */
export const web3Client = createPublicClient({
  batch: {
    multicall: { wait: 100 },
  },
  chain: base,
  // Always wrap in `fallback` (even with a single transport) so the resulting
  // client has a stable, portable type signature across all build envs.
  transport: fallback(buildTransports()),
}) as unknown as PublicClient;
