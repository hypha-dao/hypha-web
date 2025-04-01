import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const DAOProposals = await ethers.getContractFactory(
    'DAOProposalsImplementation',
  );
  console.log('Deploying DAOProposals...');

  const daoProposals = await upgrades.deployProxy(
    DAOProposals,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await daoProposals.waitForDeployment();
  console.log(
    'DAOProposals deployed to:',
    await daoProposals.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 