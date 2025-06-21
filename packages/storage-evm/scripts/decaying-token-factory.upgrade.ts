import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address from addresses.txt
const PROXY_ADDRESS = '0x299f4D2327933c1f363301dbd2a28379ccD5539b';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);

  const DecayingTokenFactory = await ethers.getContractFactory(
    'DecayingTokenFactory',
  );

  console.log('Force importing existing proxy...');
  await upgrades.forceImport(PROXY_ADDRESS, DecayingTokenFactory);

  console.log('Upgrading DecayingTokenFactory...');
  const upgradedContract = await upgrades.upgradeProxy(
    PROXY_ADDRESS,
    DecayingTokenFactory,
  );

  await upgradedContract.waitForDeployment();
  console.log(
    'DecayingTokenFactory upgraded at address:',
    await upgradedContract.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
