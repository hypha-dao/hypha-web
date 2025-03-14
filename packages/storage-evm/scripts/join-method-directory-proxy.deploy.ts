import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const JoinMethodDirectory = await ethers.getContractFactory(
    'JoinMethodDirectoryImplementation',
  );
  console.log('Deploying JoinMethodDirectory...');

  const joinMethodDirectory = await upgrades.deployProxy(
    JoinMethodDirectory,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await joinMethodDirectory.waitForDeployment();
  console.log(
    'JoinMethodDirectory deployed to:',
    await joinMethodDirectory.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
