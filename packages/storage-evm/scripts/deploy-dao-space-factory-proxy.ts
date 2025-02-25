import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const DAOSpaceFactory = await ethers.getContractFactory(
    'DAOSpaceFactoryImplementation',
  );
  console.log('Deploying DAOSpaceFactory...');

  const daoSpaceFactory = await upgrades.deployProxy(
    DAOSpaceFactory,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await daoSpaceFactory.waitForDeployment();
  console.log(
    'DAOSpaceFactory deployed to:',
    await daoSpaceFactory.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
