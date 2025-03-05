import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const ExitMethodDirectory = await ethers.getContractFactory(
    'ExitMethodDirectoryImplementation',
  );
  console.log('Deploying ExitMethodDirectory...');

  const exitMethodDirectory = await upgrades.deployProxy(
    ExitMethodDirectory,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await exitMethodDirectory.waitForDeployment();
  console.log(
    'ExitMethodDirectory deployed to:',
    await exitMethodDirectory.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 