import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log(
    'Deploying VoteDecayTokenVotingPower with admin address:',
    adminAddress,
  );

  const VoteDecayTokenVotingPower = await ethers.getContractFactory(
    'VoteDecayTokenVotingPowerImplementation', // Use the implementation contract name
  );
  console.log('Deploying VoteDecayTokenVotingPower...');

  const voteDecayTokenVotingPower = await upgrades.deployProxy(
    VoteDecayTokenVotingPower,
    [adminAddress], // Arguments for the initializer function
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await voteDecayTokenVotingPower.waitForDeployment();
  console.log(
    'VoteDecayTokenVotingPower proxy deployed to:',
    await voteDecayTokenVotingPower.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
