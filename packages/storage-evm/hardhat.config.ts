import '@nomicfoundation/hardhat-toolbox';

import { HardhatUserConfig } from 'hardhat/config';

import 'hardhat-deploy';
import '@nomiclabs/hardhat-solhint';
import 'hardhat-deploy';
import 'solidity-coverage';

import './tasks';

import '@openzeppelin/hardhat-upgrades';
import '@nomicfoundation/hardhat-ignition';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.28',
    settings: {
      optimizer: {
        enabled: true,
        runs: 200, // Low runs value for smaller contract size
      },
    },
  },
  networks: {
    'base-mainnet': {
      url: 'https://mainnet.base.org',
      accounts: [process.env.PRIVATE_KEY || ''],
    },
  },
};

export default config;
