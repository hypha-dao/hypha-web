import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const VotingPowerDirectory = await ethers.getContractFactory(
    'VotingPowerDirectoryImplementation',
  );
  console.log('Deploying VotingPowerDirectory...');

  const votingPowerDirectory = await upgrades.deployProxy(
    VotingPowerDirectory,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await votingPowerDirectory.waitForDeployment();
  console.log(
    'VotingPowerDirectory deployed to:',
    await votingPowerDirectory.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
