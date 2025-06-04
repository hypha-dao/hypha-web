import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address when upgrading
const PROXY_ADDRESS = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

async function main(): Promise<void> {
  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  // Get the current implementation address before upgrade
  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('Current implementation address:', currentImpl);

  const DAOSpaceFactory = await ethers.getContractFactory(
    'DAOSpaceFactoryImplementation',
  );

  console.log('Contract factory created successfully');
  console.log('Contract bytecode length:', DAOSpaceFactory.bytecode.length);

  let upgradedContract;

  try {
    console.log('Upgrading DAOSpaceFactory...');

    // Try with options to get more detailed error info
    upgradedContract = await upgrades.upgradeProxy(
      PROXY_ADDRESS,
      DAOSpaceFactory,
      {
        // Force the upgrade even if validation fails
        unsafeSkipStorageCheck: true,
      },
    );

    await upgradedContract.waitForDeployment();

    // Get the new implementation address after upgrade
    const newImpl = await upgrades.erc1967.getImplementationAddress(
      PROXY_ADDRESS,
    );
    console.log('New implementation address:', newImpl);

    // Verify the upgrade actually happened
    if (currentImpl.toLowerCase() === newImpl.toLowerCase()) {
      console.log(
        '⚠️  WARNING: Implementation address did not change! Upgrade may have failed.',
      );

      // Let's try to prepare the upgrade manually to see what happens
      console.log('Attempting to prepare upgrade to see deployment details...');
      const preparedImpl = await upgrades.prepareUpgrade(
        PROXY_ADDRESS,
        DAOSpaceFactory,
      );
      console.log(
        'Prepared implementation would be deployed at:',
        preparedImpl,
      );
    } else {
      console.log('✅ Implementation address changed successfully!');
    }
  } catch (error) {
    console.error('Upgrade failed with error:', error);
    throw error;
  }

  console.log(
    'DAOSpaceFactory proxy address (unchanged):',
    await upgradedContract.getAddress(),
  );

  // Wait for a few more confirmations to ensure the upgrade is fully propagated
  console.log('Waiting for additional confirmations...');
  await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

  console.log('Upgrade process completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
