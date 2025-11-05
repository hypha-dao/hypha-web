import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const OwnershipSpaceToken = await ethers.getContractFactory(
    'OwnershipSpaceToken',
  );
  console.log('Deploying OwnershipSpaceToken implementation...');

  const implementationAddress = await upgrades.deployImplementation(
    OwnershipSpaceToken,
    {
      kind: 'uups',
    },
  );

  console.log(
    'OwnershipSpaceToken implementation deployed to:',
    implementationAddress,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
