import { createConfig } from '@privy-io/wagmi';
import { http } from '@wagmi/core';
import { hardhat, base } from '@wagmi/core/chains';

export const config = createConfig({
  batch: {
    multicall: true,
  },
  chains: [hardhat, base],
  transports: {
    [base.id]: http(process.env.NEXT_PUBLIC_RPC_URL),
    [hardhat.id]: http(),
  },
});
