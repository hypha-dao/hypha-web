import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const RegularSpaceToken = await ethers.getContractFactory(
    'RegularSpaceToken',
  );
  console.log('Deploying RegularSpaceToken implementation...');

  const implementationAddress = await upgrades.deployImplementation(
    RegularSpaceToken,
    {
      kind: 'uups',
    },
  );

  console.log(
    'RegularSpaceToken implementation deployed to:',
    implementationAddress,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
