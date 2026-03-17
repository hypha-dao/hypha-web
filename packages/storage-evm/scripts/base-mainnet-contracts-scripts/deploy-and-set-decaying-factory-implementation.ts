import { ethers, upgrades } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_DECAYING_FACTORY_ADDRESS =
  '0x299f4D2327933c1f363301dbd2a28379ccD5539b';

const DECAYING_FACTORY_ABI = [
  'function owner() view returns (address)',
  'function decayingTokenImplementation() view returns (address)',
  'function setDecayingTokenImplementation(address _implementation)',
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
    getEnv('DECAYING_FACTORY_ADDRESS') ?? DEFAULT_DECAYING_FACTORY_ADDRESS;
  const dryRun = parseBoolean(getEnv('DRY_RUN'), false);

  if (!ethers.isAddress(factoryAddress)) {
    throw new Error(`Invalid DECAYING_FACTORY_ADDRESS: ${factoryAddress}`);
  }

  const factory = new ethers.Contract(
    factoryAddress,
    DECAYING_FACTORY_ABI,
    signer,
  );

  console.log('='.repeat(72));
  console.log('DEPLOY + SET DECAYING FACTORY IMPLEMENTATION');
  console.log('='.repeat(72));
  console.log(`Network chainId: ${network.chainId}`);
  console.log(`Signer: ${signerAddress}`);
  console.log(`Decaying factory: ${factoryAddress}`);
  console.log(`Dry run: ${dryRun ? 'YES' : 'NO'}`);

  const owner = await factory.owner();
  console.log(`Factory owner: ${owner}`);
  if (owner.toLowerCase() !== signerAddress.toLowerCase()) {
    throw new Error(
      `Signer is not factory owner. owner=${owner}, signer=${signerAddress}`,
    );
  }

  const currentImplementation = await factory.decayingTokenImplementation();
  console.log(`Current implementation: ${currentImplementation}`);

  if (dryRun) {
    console.log(
      'DRY_RUN=true, skipping deployImplementation and setDecayingTokenImplementation.',
    );
    return;
  }

  console.log('\nDeploying new DecayingSpaceToken implementation...');
  const decayingTokenFactory = await ethers.getContractFactory(
    'DecayingSpaceToken',
  );
  const newImplementation = (await upgrades.deployImplementation(
    decayingTokenFactory,
    {
      kind: 'uups',
    },
  )) as string;
  console.log(`New implementation deployed: ${newImplementation}`);

  if (!ethers.isAddress(newImplementation)) {
    throw new Error(`Deployed implementation is invalid: ${newImplementation}`);
  }

  if (newImplementation.toLowerCase() === currentImplementation.toLowerCase()) {
    console.log('Deployed implementation matches current factory setting.');
    return;
  }

  console.log('\nUpdating DecayingTokenFactory implementation pointer...');
  const tx = await factory.setDecayingTokenImplementation(newImplementation);
  console.log(`Tx sent: ${tx.hash}`);
  const receipt = await tx.wait();
  console.log(`Tx confirmed in block: ${receipt?.blockNumber}`);

  const updatedImplementation = await factory.decayingTokenImplementation();
  console.log(`Updated implementation: ${updatedImplementation}`);

  if (updatedImplementation.toLowerCase() !== newImplementation.toLowerCase()) {
    throw new Error('Post-check failed: implementation was not updated');
  }

  console.log('\nDecaying factory implementation updated successfully.');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error.message);
    process.exit(1);
  });
