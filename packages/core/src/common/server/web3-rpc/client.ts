import 'server-only';

import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';

export const web3Client = createPublicClient({
  batch: {
    multicall: { wait: 100 },
  },
  chain: base,
  transport: process.env.RPC_URL ? http(process.env.RPC_URL) : http(),
});
