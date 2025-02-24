import * as fs from 'fs';
import * as path from 'path';

import { defineConfig } from '@wagmi/cli';
import { hardhat } from '@wagmi/cli/plugins';

/**
 * Gets the deployed contract address from the deployments JSON file
 * @param contract The contract name to look up (e.g. "SpaceFactoryModule#SpaceFactory")
 * @returns The deployed contract address
 * @throws Error if contract address not found
 */
export function getContractAddress(
  contract: string,
  chain: number = 31337,
): `0x${string}` {
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
      project: '.',
      include: ['SpaceFactory.sol/**'],
      deployments: {
        SpaceFactory: {
          31337: getContractAddress('SpaceFactoryModule#SpaceFactory', 31337),
        },
      },
    }),
  ],
});
