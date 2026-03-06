import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address when upgrading
const PROXY_ADDRESS = '0xA2F352351A97b505115D7e4c5d048105A7B42285'; // TODO: REPLACE WITH YOUR PROXY ADDRESS

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

  // This should be the new implementation contract
  const RNDAODecayingSpaceToken = await ethers.getContractFactory(
    'RNDAODecayingSpaceToken',
  );

  console.log('Contract factory created successfully');
  console.log(
    'Contract bytecode length:',
    RNDAODecayingSpaceToken.bytecode.length,
  );

  let upgradedContract;

  try {
    console.log('Upgrading to RNDAODecayingSpaceToken...');

    // Try with options to get more detailed error info
    upgradedContract = await upgrades.upgradeProxy(
      PROXY_ADDRESS,
      RNDAODecayingSpaceToken,
      {
        // Force the upgrade even if validation fails
        unsafeSkipStorageCheck: true,
        unsafeAllow: ['missing-initializer'],
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
        RNDAODecayingSpaceToken,
        {
          unsafeSkipStorageCheck: true,
          unsafeAllow: ['missing-initializer'],
        },
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
        await upgrades.forceImport(PROXY_ADDRESS, RNDAODecayingSpaceToken, {
          kind: 'uups',
        });
        console.log('✅ Proxy successfully imported. Retrying upgrade...');

        // Now try the upgrade again
        upgradedContract = await upgrades.upgradeProxy(
          PROXY_ADDRESS,
          RNDAODecayingSpaceToken,
          {
            unsafeSkipStorageCheck: true,
            unsafeAllow: ['missing-initializer'],
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
    'RNDAODecayingSpaceToken proxy address (unchanged):',
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
