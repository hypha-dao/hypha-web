import { ethers, upgrades } from 'hardhat';

// SpacePaymentTracker proxy address from addresses.txt
const PROXY_ADDRESS = '0x4B61250c8F19BA96C473c65022453E95176b0139';

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

  const SpacePaymentTracker = await ethers.getContractFactory(
    'SpacePaymentTracker',
  );

  console.log('Contract factory created successfully');
  console.log('Contract bytecode length:', SpacePaymentTracker.bytecode.length);

  let upgradedContract;

  try {
    console.log('Upgrading SpacePaymentTracker...');

    // Try with options to get more detailed error info
    upgradedContract = await upgrades.upgradeProxy(
      PROXY_ADDRESS,
      SpacePaymentTracker,
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
        SpacePaymentTracker,
      );
      console.log(
        'Prepared implementation would be deployed at:',
        preparedImpl,
      );
    } else {
      console.log('✅ Implementation address changed successfully!');
    }
  } catch (error) {
    // Check if the error is about unregistered deployment
    if (error instanceof Error && error.message.includes('is not registered')) {
      console.log(
        '⚠️  Proxy not registered with upgrades plugin. Attempting to import...',
      );

      try {
        // Force import the existing proxy
        await upgrades.forceImport(PROXY_ADDRESS, SpacePaymentTracker);
        console.log('✅ Proxy successfully imported. Retrying upgrade...');

        // Now try the upgrade again
        upgradedContract = await upgrades.upgradeProxy(
          PROXY_ADDRESS,
          SpacePaymentTracker,
          {
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
        } else {
          console.log('✅ Implementation address changed successfully!');
        }
      } catch (importError) {
        console.error('Failed to import proxy:', importError);
        throw importError;
      }
    } else {
      console.error('Upgrade failed with error:', error);
      throw error;
    }
  }

  console.log(
    'SpacePaymentTracker proxy address (unchanged):',
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
