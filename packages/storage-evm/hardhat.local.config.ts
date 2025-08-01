import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@openzeppelin/hardhat-upgrades';
import 'hardhat-deploy';

const config: HardhatUserConfig = {
  solidity: '0.8.28',
  gasReporter: {
    enabled: process.env.REPORT_GAS ? true : false,
  },
  networks: {
    hardhat: {
      chainId: 31337, // it's the default chain id, doesn't need to add it.
      accounts: {
        count: 60, // Increased from default 20 to support 50-member tests
      },
    },
  },
};

export default config;
