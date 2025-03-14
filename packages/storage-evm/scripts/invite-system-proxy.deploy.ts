import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const InviteSystem = await ethers.getContractFactory(
    'InviteSystemImplementation',
  );
  console.log('Deploying InviteSystem...');

  const inviteSystem = await upgrades.deployProxy(
    InviteSystem,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await inviteSystem.waitForDeployment();
  console.log('InviteSystem deployed to:', await inviteSystem.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
