import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const VotingPowerDelegation = await ethers.getContractFactory(
    'VotingPowerDelegationImplementation',
  );
  console.log('Deploying VotingPowerDelegation...');

  const votingPowerDelegation = await upgrades.deployProxy(
    VotingPowerDelegation,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await votingPowerDelegation.waitForDeployment();
  console.log(
    'VotingPowerDelegation deployed to:',
    await votingPowerDelegation.getAddress(),
  );

  // Log additional deployment info
  console.log('Contract details:');
  console.log('- Owner:', await votingPowerDelegation.owner());
  console.log('- Implementation supports UUPS upgrades');
  console.log('- Ready to be linked to voting power contracts');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
