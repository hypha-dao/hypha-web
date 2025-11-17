import '@nomicfoundation/hardhat-toolbox';

import { HardhatUserConfig } from 'hardhat/config';

import 'hardhat-deploy';
import '@nomiclabs/hardhat-solhint';
import 'hardhat-deploy';
import 'solidity-coverage';
import 'hardhat-contract-sizer';

import './tasks';

import '@openzeppelin/hardhat-upgrades';
import '@nomicfoundation/hardhat-ignition';

import * as dotenv from 'dotenv';
dotenv.config();

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
  networks: {},
};

if (process.env.PRIVATE_KEY) {
  config.networks!['base-mainnet'] = {
    url: 'https://mainnet.base.org',
    accounts: [process.env.PRIVATE_KEY],
  };
}

export default config;
