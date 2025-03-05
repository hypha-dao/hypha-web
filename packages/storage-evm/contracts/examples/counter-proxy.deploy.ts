import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const Counter = await ethers.getContractFactory('Counter');
  console.log('Deploying Counter...');
  const counter = await upgrades.deployProxy(Counter, {
    initializer: 'initialize',
    kind: 'uups',
  });
  await counter.waitForDeployment();
  console.log('Counter deployed to:', await counter.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
