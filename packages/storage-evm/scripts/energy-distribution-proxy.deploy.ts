import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const EnergyDistribution = await ethers.getContractFactory(
    'EnergyDistributionImplementation',
  );
  console.log('Deploying EnergyDistribution...');

  const energyDistribution = await upgrades.deployProxy(
    EnergyDistribution,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await energyDistribution.waitForDeployment();
  console.log(
    'EnergyDistribution deployed to:',
    await energyDistribution.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 