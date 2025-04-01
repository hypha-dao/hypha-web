import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address when deploying
const PROXY_ADDRESS = '0x0000000000000000000000000000000000000000';

async function main(): Promise<void> {
  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);

  const DAOProposals = await ethers.getContractFactory(
    'DAOProposalsImplementation',
  );

  console.log('Upgrading DAOProposals...');
  const upgradedContract = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    DAOProposals,
  );

  await upgradedContract.waitForDeployment();
  console.log(
    'DAOProposals upgraded at address:',
    await upgradedContract.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 