import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log(
    'Deploying OwnershipTokenVotingPower with admin address:',
    adminAddress,
  );

  const OwnershipTokenVotingPower = await ethers.getContractFactory(
    'OwnershipTokenVotingPowerImplementation', // Use the implementation contract name
  );
  console.log('Deploying OwnershipTokenVotingPower...');

  const ownershipTokenVotingPower = await upgrades.deployProxy(
    OwnershipTokenVotingPower,
    [adminAddress], // Arguments for the initializer function
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await ownershipTokenVotingPower.waitForDeployment();
  console.log(
    'OwnershipTokenVotingPower proxy deployed to:',
    await ownershipTokenVotingPower.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
