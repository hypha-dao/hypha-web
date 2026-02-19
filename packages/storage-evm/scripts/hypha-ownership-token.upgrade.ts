import { ethers, upgrades } from 'hardhat';

const PROXY_ADDRESS = '0x5d3394CAa6D09214aB86CF048e39dea058eC1921';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading with admin address:', adminAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  // Get the current implementation address before upgrade
  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('Current implementation address:', currentImpl);

  const HyphaOwnershipTokenContract = await ethers.getContractFactory(
    'HyphaOwnershipTokenContract',
  );

  console.log('Contract factory created successfully');
  console.log(
    'Contract bytecode length:',
    HyphaOwnershipTokenContract.bytecode.length,
  );

  let upgradedContract;

  try {
    console.log('Upgrading to HyphaOwnershipTokenContract...');

    upgradedContract = await upgrades.upgradeProxy(
      PROXY_ADDRESS,
      HyphaOwnershipTokenContract,
      {
        unsafeSkipStorageCheck: true,
        unsafeAllow: ['missing-initializer'],
      },
    );

    await upgradedContract.waitForDeployment();

    const newImpl = await upgrades.erc1967.getImplementationAddress(
      PROXY_ADDRESS,
    );
    console.log('New implementation address:', newImpl);

    if (currentImpl.toLowerCase() === newImpl.toLowerCase()) {
      console.log(
        '⚠️  WARNING: Implementation address did not change! Upgrade may have failed.',
      );

      console.log('Attempting to prepare upgrade to see deployment details...');
      const preparedImpl = await upgrades.prepareUpgrade(
        PROXY_ADDRESS,
        HyphaOwnershipTokenContract,
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
    if (error instanceof Error && error.message.includes('is not registered')) {
      console.log(
        '⚠️  Proxy not registered with upgrades plugin. Attempting to import...',
      );

      try {
        await upgrades.forceImport(
          PROXY_ADDRESS,
          HyphaOwnershipTokenContract,
          {
            kind: 'uups',
          },
        );
        console.log('✅ Proxy successfully imported. Retrying upgrade...');

        upgradedContract = await upgrades.upgradeProxy(
          PROXY_ADDRESS,
          HyphaOwnershipTokenContract,
          {
            unsafeSkipStorageCheck: true,
            unsafeAllow: ['missing-initializer'],
          },
        );

        await upgradedContract.waitForDeployment();

        const newImpl = await upgrades.erc1967.getImplementationAddress(
          PROXY_ADDRESS,
        );
        console.log('New implementation address:', newImpl);

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
    'HyphaOwnershipTokenContract proxy address (unchanged):',
    await upgradedContract.getAddress(),
  );

  console.log('Waiting for additional confirmations...');
  await new Promise((resolve) => setTimeout(resolve, 10000));

  console.log('Upgrade process completed!');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });


