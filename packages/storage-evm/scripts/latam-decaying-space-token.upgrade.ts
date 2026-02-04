import { ethers, upgrades } from 'hardhat';

// Latam token proxy address
const PROXY_ADDRESS = '0xc79A492cD1CAB9813f89A39522FC00BEa7A74CBb';

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
  const LatamDecayingSpaceToken = await ethers.getContractFactory(
    'LatamDecayingSpaceToken',
  );

  console.log('Contract factory created successfully');
  console.log(
    'Contract bytecode length:',
    LatamDecayingSpaceToken.bytecode.length,
  );

  let upgradedContract;

  try {
    console.log('Upgrading to LatamDecayingSpaceToken...');

    // Try with options to get more detailed error info
    upgradedContract = await upgrades.upgradeProxy(
      PROXY_ADDRESS,
      LatamDecayingSpaceToken,
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
        LatamDecayingSpaceToken,
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
        await upgrades.forceImport(PROXY_ADDRESS, LatamDecayingSpaceToken, {
          kind: 'uups',
        });
        console.log('✅ Proxy successfully imported. Retrying upgrade...');

        // Now try the upgrade again
        upgradedContract = await upgrades.upgradeProxy(
          PROXY_ADDRESS,
          LatamDecayingSpaceToken,
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
    'LatamDecayingSpaceToken proxy address (unchanged):',
    await upgradedContract.getAddress(),
  );

  // Wait for a few more confirmations to ensure the upgrade is fully propagated
  console.log('Waiting for additional confirmations...');
  await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

  console.log('Upgrade process completed!');

  // Set decay rate to 0 to disable decay
  console.log('Setting decay rate to 0...');
  const currentDecayRate = await upgradedContract.decayRate();
  console.log('Current decay rate:', currentDecayRate.toString());

  const tx = await upgradedContract.setDecayRate(0);
  await tx.wait();

  const newDecayRate = await upgradedContract.decayRate();
  console.log('New decay rate:', newDecayRate.toString());
  console.log('✅ Decay rate set to 0 successfully!');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });

