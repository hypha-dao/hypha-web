import '@nomicfoundation/hardhat-toolbox';

import { HardhatUserConfig } from 'hardhat/config';

import 'hardhat-deploy';
import '@nomiclabs/hardhat-solhint';
import 'hardhat-deploy';
import 'solidity-coverage';

import './tasks';
import { env } from './src/env';

import '@openzeppelin/hardhat-upgrades';
import '@nomicfoundation/hardhat-ignition';

const { BASE_MAINNET_RPC_URL, PRIVATE_KEY } = env;

const config: HardhatUserConfig = {
  solidity: '0.8.28',
  networks: {
    'base-mainnet': {
      url: BASE_MAINNET_RPC_URL,
      accounts: [PRIVATE_KEY],
    },
  },
};

export default config;
