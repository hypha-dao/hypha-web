import * as fs from 'fs';
import * as path from 'path';
import { base } from '@wagmi/core/chains';
// import { hardhat as HHC } from '@wagmi/core/chains';

import { defineConfig } from '@wagmi/cli';
import { hardhat } from '@wagmi/cli/plugins';

/**
 * Gets the deployed contract address from the deployments JSON file
 * @param contract The contract name to look up (e.g. "SpaceFactoryModule#SpaceFactory")
 * @returns The deployed contract address
 * @throws Error if contract address not found
 */
function getContractAddress(contract: string, chain = 31337): `0x${string}` {
  // Read the deployed addresses file
  const addressesPath = path.join(
    __dirname,
    `ignition/deployments/chain-${chain}/deployed_addresses.json`,
  );
  const addresses = JSON.parse(fs.readFileSync(addressesPath, 'utf8'));

  // Look up the contract address
  const address = addresses[contract];
  if (!address) {
    throw new Error(`Contract address not found for: ${contract}`);
  }

  return address;
}

export default defineConfig({
  out: 'src/generated.ts',
  contracts: [],
  plugins: [
    hardhat({
      project: '../storage-evm/',
      include: [
        'SpaceFactory.sol/**',
        'DAOSpaceFactoryImplementation.sol/**',
        'SpaceFactoryProxy.sol/**',
        'SpaceFactoryV1.sol/**',
        'SpaceFactoryV2.sol/**',
      ],
      deployments: {
        DAOSpaceFactoryImplementation: {
          [base.id]: '0xff6006c67803a380Db25230F1aEc605790C405a1',
        },
        // SpaceFactoryV1: {
        //   [HHC.id]: getContractAddress(
        //     'SpaceFactoryProxyModule#SpaceFactoryV1',
        //     HHC.id,
        //   ),
        // },
        // TransparentUpgradeableProxy: {
        //   [HHC.id]: getContractAddress(
        //     'SpaceFactoryProxyModule#TransparentUpgradeableProxy',
        //     HHC.id,
        //   ),
        // },
        // ProxyAdmin: {
        //   [HHC.id]: getContractAddress(
        //     'SpaceFactoryProxyModule#ProxyAdmin',
        //     HHC.id,
        //   ),
        // },
        // ProxiedSpaceFactoryV1: {
        //   [HHC.id]: getContractAddress(
        //     'SpaceFactoryV1Module#SpaceFactoryV1',
        //     HHC.id,
        //   ),
        // },
        // ProxiedSpaceFactoryV2: {
        //   [HHC.id]: getContractAddress(
        //     'SpaceFactoryV2Module#SpaceFactoryV2',
        //     HHC.id,
        //   ),
        // },
        // SpaceFactoryV2: {
        //   [HHC.id]: getContractAddress(
        //     'SpaceFactoryProxyUpgradeModule#SpaceFactoryV2',
        //     HHC.id,
        //   ),
        // },
      },
    }),
  ],
});
