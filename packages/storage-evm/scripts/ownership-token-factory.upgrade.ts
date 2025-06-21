import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address from addresses.txt
const PROXY_ADDRESS = '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);

  const OwnershipTokenFactory = await ethers.getContractFactory(
    'OwnershipTokenFactory',
  );

  console.log('Force importing existing proxy...');
  await upgrades.forceImport(PROXY_ADDRESS, OwnershipTokenFactory);

  console.log('Upgrading OwnershipTokenFactory...');
  const upgradedContract = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    OwnershipTokenFactory,
  );

  await upgradedContract.waitForDeployment();
  console.log(
    'OwnershipTokenFactory upgraded at address:',
    await upgradedContract.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
