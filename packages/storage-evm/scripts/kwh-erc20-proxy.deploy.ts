import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying KWH Token contract with admin address:', adminAddress);

  const KWHERC20 = await ethers.getContractFactory('KWHERC20Implementation');
  console.log('Deploying KWHERC20...');

  const kwhToken = await upgrades.deployProxy(
    KWHERC20,
    [adminAddress], // Pass the admin address to the initializer
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await kwhToken.waitForDeployment();
  console.log('KWH Token deployed to:', await kwhToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
