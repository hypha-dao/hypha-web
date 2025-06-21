import { ethers, upgrades } from 'hardhat';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Deploying with admin address:', adminAddress);

  const EscrowImplementation = await ethers.getContractFactory(
    'EscrowImplementation',
  );
  console.log('Deploying Escrow...');

  const escrow = await upgrades.deployProxy(
    EscrowImplementation,
    [adminAddress], // Initial owner
    {
      initializer: 'initialize',
      kind: 'uups',
    },
  );

  await escrow.waitForDeployment();
  console.log('Escrow deployed to:', await escrow.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
