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
  solidity: '0.8.28',
  networks: {
    'base-mainnet': {
      url: 'https://mainnet.base.org',
      accounts: [process.env.PRIVATE_KEY || ''],
    },
  },
};

export default config;
