import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const WorkProposal = await ethers.getContractFactory(
    'WorkProposalImplementation',
  );
  console.log('Deploying WorkProposal...');

  const workProposal = await upgrades.deployProxy(
    WorkProposal,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await workProposal.waitForDeployment();
  console.log(
    'WorkProposal deployed to:',
    await workProposal.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 