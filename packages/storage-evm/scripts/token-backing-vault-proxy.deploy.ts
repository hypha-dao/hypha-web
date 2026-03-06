import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  // The DAOSpaceFactory proxy address on Base mainnet.
  // Override via DAO_SPACE_FACTORY_ADDRESS env var if needed.
  const spacesContract =
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
    '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

  console.log('Deploying with admin address:', adminAddress);
  console.log('Using DAOSpaceFactory at:', spacesContract);

  const TokenBackingVault = await ethers.getContractFactory(
    'TokenBackingVaultImplementation',
  );
  console.log('Deploying TokenBackingVault...');

  const vault = await upgrades.deployProxy(
    TokenBackingVault,
    [adminAddress, spacesContract],
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await vault.waitForDeployment();
  console.log('TokenBackingVault deployed to:', await vault.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
