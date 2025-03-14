import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const TokenBalanceJoin = await ethers.getContractFactory(
    'TokenBalanceJoinImplementation',
  );
  console.log('Deploying TokenBalanceJoin...');

  const tokenBalanceJoin = await upgrades.deployProxy(
    TokenBalanceJoin,
    [adminAddress],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await tokenBalanceJoin.waitForDeployment();
  console.log(
    'TokenBalanceJoin deployed to:',
    await tokenBalanceJoin.getAddress(),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
