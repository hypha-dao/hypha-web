import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const Agreements = await ethers.getContractFactory(
    'AgreementsImplementation',
  );
  console.log('Deploying Agreements...');

  const agreements = await upgrades.deployProxy(Agreements, [adminAddress], {
    initializer: 'initialize',
    kind: 'uups',
  });

  await agreements.waitForDeployment();
  console.log('Agreements deployed to:', await agreements.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
