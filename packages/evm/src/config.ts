import { createConfig } from '@privy-io/wagmi';
import { http } from '@wagmi/core';
import { hardhat, base } from '@wagmi/core/chains';

export const config = createConfig({
  chains: [hardhat, base],
  transports: {
    [base.id]: http(),
    [hardhat.id]: http(),
  },
});
