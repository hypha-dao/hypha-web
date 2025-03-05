import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address when deploying
const PROXY_ADDRESS = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

async function main(): Promise<void> {
  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);

  const DAOSpaceFactory = await ethers.getContractFactory(
    'DAOSpaceFactoryImplementation'  // Make sure this matches your V2 contract name
  );
  
  console.log('Upgrading DAOSpaceFactory...');
  const upgradedContract = await upgrades.upgradeProxy(PROXY_ADDRESS, DAOSpaceFactory);
  
  await upgradedContract.waitForDeployment();
  console.log(
    'DAOSpaceFactory upgraded at address:',
    await upgradedContract.getAddress()
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 