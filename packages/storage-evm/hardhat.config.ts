import '@nomicfoundation/hardhat-toolbox';

import { HardhatUserConfig } from 'hardhat/config';

import 'hardhat-deploy';
import '@nomiclabs/hardhat-solhint';
import 'hardhat-deploy';
import 'solidity-coverage';
import 'hardhat-contract-sizer';
import dotenv from 'dotenv';

dotenv.config();

import './tasks';

import '@openzeppelin/hardhat-upgrades';
import '@nomicfoundation/hardhat-ignition';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.28',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
          viaIR: true,
        },
      },
    ],
  },
  networks: {
    'base-mainnet': {
      url: process.env.RPC_URL || '',
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL || 'https://rpc.ankr.com/polygon_mumbai',
      accounts:
        process.env.PRIVATE_KEY !== undefined ? [process.env.PRIVATE_KEY] : [],
    },
    localhost: {
      url: 'http://127.0.0.1:8545',
    },
  },
  gasReporter: {
    enabled: process.env.REPORT_GAS !== undefined,
    currency: 'USD',
    outputFile: 'gas-report.txt',
    noColors: true,
    coinmarketcap: process.env.COINMARKETCAP_API_KEY,
  },
};

export default config;
