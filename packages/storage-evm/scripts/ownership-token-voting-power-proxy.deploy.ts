import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const OwnershipTokenVotingPower = await ethers.getContractFactory(
    'OwnershipTokenVotingPowerImplementation',
  );
  console.log('Deploying OwnershipTokenVotingPower...');

  const ownershipTokenVotingPower = await upgrades.deployProxy(
    OwnershipTokenVotingPower,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await ownershipTokenVotingPower.waitForDeployment();
  console.log(
    'OwnershipTokenVotingPowerImplementation proxy deployed to:',
    await ownershipTokenVotingPower.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
