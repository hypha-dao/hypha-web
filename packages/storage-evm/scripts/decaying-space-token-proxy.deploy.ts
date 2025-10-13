import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const DecayingSpaceToken = await ethers.getContractFactory(
    'DecayingSpaceToken',
  );
  console.log('Deploying DecayingSpaceToken implementation...');

  const implementationAddress = await upgrades.deployImplementation(
    DecayingSpaceToken,
    {
      kind: 'uups',
    },
  );

  console.log(
    'DecayingSpaceToken implementation deployed to:',
    implementationAddress,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
