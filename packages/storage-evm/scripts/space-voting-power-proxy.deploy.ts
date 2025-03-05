import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const SpaceVotingPower = await ethers.getContractFactory(
    'SpaceVotingPowerImplementation',
  );
  console.log('Deploying SpaceVotingPower...');

  const spaceVotingPower = await upgrades.deployProxy(
    SpaceVotingPower,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await spaceVotingPower.waitForDeployment();
  console.log(
    'SpaceVotingPower deployed to:',
    await spaceVotingPower.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 