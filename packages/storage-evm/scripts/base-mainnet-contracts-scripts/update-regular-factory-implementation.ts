import { ethers } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_REGULAR_FACTORY_ADDRESS =
  '0x95A33EC94de2189893884DaD63eAa19f7390144a';
const DEFAULT_NEW_REGULAR_IMPLEMENTATION =
  '0x3612C9555f0fa327c892f5cEAD49c98D84aa2565';

const REGULAR_FACTORY_ABI = [
  'function owner() view returns (address)',
  'function spaceTokenImplementation() view returns (address)',
  'function setSpaceTokenImplementation(address _implementation)',
];

function getEnv(name: string): string | undefined {
  const value = process.env[name];
  if (!value) return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function parseBoolean(value: string | undefined, fallback: boolean): boolean {
  if (!value) return fallback;
  const normalized = value.toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

async function main(): Promise<void> {
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  const network = await ethers.provider.getNetwork();

  const factoryAddress =
    getEnv('REGULAR_FACTORY_ADDRESS') ?? DEFAULT_REGULAR_FACTORY_ADDRESS;
  const newImplementation =
    getEnv('NEW_REGULAR_IMPLEMENTATION') ??
    DEFAULT_NEW_REGULAR_IMPLEMENTATION;
  const dryRun = parseBoolean(getEnv('DRY_RUN'), false);

  if (!ethers.isAddress(factoryAddress)) {
    throw new Error(`Invalid REGULAR_FACTORY_ADDRESS: ${factoryAddress}`);
  }

  if (!ethers.isAddress(newImplementation)) {
    throw new Error(`Invalid NEW_REGULAR_IMPLEMENTATION: ${newImplementation}`);
  }

  const factory = new ethers.Contract(factoryAddress, REGULAR_FACTORY_ABI, signer);

  console.log('='.repeat(68));
  console.log('UPDATE REGULAR FACTORY IMPLEMENTATION');
  console.log('='.repeat(68));
  console.log(`Network chainId: ${network.chainId}`);
  console.log(`Signer: ${signerAddress}`);
  console.log(`Regular factory: ${factoryAddress}`);
  console.log(`Target implementation: ${newImplementation}`);
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);

  const owner = await factory.owner();
  console.log(`Factory owner: ${owner}`);
  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(
      `Signer is not factory owner. owner=${owner}, signer=${signerAddress}`,
    );
  }

  const currentImplementation = await factory.spaceTokenImplementation();
  console.log(`Current implementation: ${currentImplementation}`);

  if (currentImplementation.toLowerCase() === newImplementation.toLowerCase()) {
    console.log('Already set to target implementation. Nothing to do.');
    return;
  }

  if (dryRun) {
    console.log('DRY_RUN=true, skipping transaction.');
    console.log(`Would update from ${currentImplementation} to ${newImplementation}`);
    return;
  }

  const tx = await factory.setSpaceTokenImplementation(newImplementation);
  console.log(`Tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Tx confirmed in block: ${receipt?.blockNumber}`);

  const updatedImplementation = await factory.spaceTokenImplementation();
  console.log(`Updated implementation: ${updatedImplementation}`);

  if (updatedImplementation.toLowerCase() !== newImplementation.toLowerCase()) {
    throw new Error('Post-check failed: implementation was not updated');
  }

  console.log('Regular factory implementation updated successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
