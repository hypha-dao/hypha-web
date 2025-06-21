import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address from addresses.txt
const PROXY_ADDRESS = '0x95A33EC94de2189893884DaD63eAa19f7390144a';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);

  const RegularTokenFactory = await ethers.getContractFactory(
    'RegularTokenFactory',
  );

  console.log('Upgrading RegularTokenFactory...');
  const upgradedContract = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    RegularTokenFactory,
  );

  await upgradedContract.waitForDeployment();
  console.log(
    'RegularTokenFactory upgraded at address:',
    await upgradedContract.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
