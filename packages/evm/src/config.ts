import { http, createConfig } from '@wagmi/core';
import { hardhat, base } from '@wagmi/core/chains';

export const config = createConfig({
  chains: [hardhat, base],
  transports: {
    [base.id]: http(),
    [hardhat.id]: http(),
  },
});
