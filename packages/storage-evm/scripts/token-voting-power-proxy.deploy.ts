import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const TokenVotingPower = await ethers.getContractFactory(
    'TokenVotingPowerImplementation',
  );
  console.log('Deploying TokenVotingPower...');

  const tokenVotingPower = await upgrades.deployProxy(
    TokenVotingPower,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await tokenVotingPower.waitForDeployment();
  console.log(
    'TokenVotingPower deployed to:',
    await tokenVotingPower.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  }); 