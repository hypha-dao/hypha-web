import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import 'hardhat-gas-reporter';

const config: HardhatUserConfig = {
  solidity: '0.8.28',
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  networks: {
    hardhat: {
      chainId: 31337, // it's the default chain id, doesn't need to add it.
    },
  },
};

export default config;
