import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const SpaceToken = await ethers.getContractFactory(
    'contracts/RegularSpaceToken.sol:SpaceToken',
  );
  console.log('Deploying SpaceToken...');

  // Set the arguments for the initializer function
  const name = 'My Space Token';
  const symbol = 'MST';
  const executor = adminAddress;
  const spaceId = 1;
  const maxSupply = 1000000; // Example max supply
  const transferable = true;

  const spaceToken = await upgrades.deployProxy(
    SpaceToken,
    [name, symbol, executor, spaceId, maxSupply, transferable],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await spaceToken.waitForDeployment();
  console.log('SpaceToken deployed to:', await spaceToken.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
