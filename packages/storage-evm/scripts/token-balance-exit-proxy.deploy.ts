import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const TokenBalanceExit = await ethers.getContractFactory(
    'TokenBalanceExitImplementation',
  );
  console.log('Deploying TokenBalanceExit...');

  const tokenBalanceExit = await upgrades.deployProxy(
    TokenBalanceExit,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await tokenBalanceExit.waitForDeployment();
  console.log(
    'TokenBalanceExit deployed to:',
    await tokenBalanceExit.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
