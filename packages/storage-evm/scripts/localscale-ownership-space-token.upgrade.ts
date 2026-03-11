import { ethers, upgrades } from 'hardhat';

// LocalScale token proxy address
const PROXY_ADDRESS = '0x085a2bd60b5c786aDdf1cF87D72735ae4974D90b';
const SPACES_CONTRACT = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

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
  const LocalScaleOwnershipToken = await ethers.getContractFactory(
    'LocalScaleOwnershipToken',
  );

  console.log('Contract factory created successfully');
  console.log(
    'Contract bytecode length:',
    LocalScaleOwnershipToken.bytecode.length,
  );

  let upgradedContract;

  try {
    console.log('Upgrading to LocalScaleOwnershipToken...');

    // Try with options to get more detailed error info
    upgradedContract = await upgrades.upgradeProxy(
      PROXY_ADDRESS,
      LocalScaleOwnershipToken,
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
        LocalScaleOwnershipToken,
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
        await upgrades.forceImport(PROXY_ADDRESS, LocalScaleOwnershipToken, {
          kind: 'uups',
        });
        console.log('✅ Proxy successfully imported. Retrying upgrade...');

        // Now try the upgrade again
        upgradedContract = await upgrades.upgradeProxy(
          PROXY_ADDRESS,
          LocalScaleOwnershipToken,
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
    'LocalScaleOwnershipToken proxy address (unchanged):',
    await upgradedContract.getAddress(),
  );

  // Ensure ownership membership contract is configured after upgrade.
  const currentSpacesContract =
    await upgradedContract.ownershipSpacesContract();
  if (currentSpacesContract.toLowerCase() !== SPACES_CONTRACT.toLowerCase()) {
    console.log(
      `Updating ownershipSpacesContract from ${currentSpacesContract} to ${SPACES_CONTRACT}...`,
    );
    const setSpacesTx = await upgradedContract.setOwnershipSpacesContract(
      SPACES_CONTRACT,
    );
    await setSpacesTx.wait();
    const updatedSpacesContract =
      await upgradedContract.ownershipSpacesContract();
    console.log('ownershipSpacesContract updated to:', updatedSpacesContract);
  } else {
    console.log('ownershipSpacesContract already configured:', SPACES_CONTRACT);
  }

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
