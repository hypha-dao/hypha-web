import { ethers, upgrades } from 'hardhat';

// Replace this with your actual proxy address when upgrading
// This should be the address of your deployed EnergyToken proxy
const PROXY_ADDRESS = '0xAe47243cfa71f4B95BCf6E2BB1D4F59599B963F0';

async function main(): Promise<void> {
  // Get the deployer's address
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('Upgrading Energy Token with admin address:', adminAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  // Get the current implementation address before upgrade
  const currentImpl = await upgrades.erc1967.getImplementationAddress(
    PROXY_ADDRESS,
  );
  console.log('Current implementation address:', currentImpl);

  // Note: The contract in energytokenupdatable.sol is named "RegularSpaceToken"
  // Make sure this matches your actual contract name
  const EnergyToken = await ethers.getContractFactory('RegularSpaceToken');

  console.log('Contract factory created successfully');
  console.log('Contract bytecode length:', EnergyToken.bytecode.length);

  let upgradedContract;

  try {
    // First, try to import the proxy if it's not registered
    try {
      await upgrades.forceImport(PROXY_ADDRESS, EnergyToken);
      console.log('✅ Proxy imported successfully');
    } catch (e) {
      // If already imported, that's fine
      console.log('Proxy already imported or import not needed');
    }

    console.log('Deploying new implementation...');

    // Force deploy a new implementation by using prepareUpgrade with redeployImplementation option
    const newImplAddress = await upgrades.prepareUpgrade(
      PROXY_ADDRESS,
      EnergyToken,
      {
        unsafeSkipStorageCheck: true,
        redeployImplementation: 'always', // Force redeploy
      },
    );

    console.log('New implementation deployed at:', newImplAddress);

    // Now upgrade to the new implementation
    console.log('Upgrading proxy to new implementation...');
    upgradedContract = await upgrades.upgradeProxy(PROXY_ADDRESS, EnergyToken, {
      unsafeSkipStorageCheck: true,
    });

    await upgradedContract.waitForDeployment();

    // Get the new implementation address after upgrade
    const newImpl = await upgrades.erc1967.getImplementationAddress(
      PROXY_ADDRESS,
    );
    console.log('Proxy now points to implementation:', newImpl);

    // Verify the upgrade actually happened
    if (currentImpl.toLowerCase() === newImpl.toLowerCase()) {
      console.log(
        '⚠️  WARNING: Implementation address did not change! Upgrade may have failed.',
      );
    } else {
      console.log('✅ Implementation address changed successfully!');
      console.log(`  Old: ${currentImpl}`);
      console.log(`  New: ${newImpl}`);
    }
  } catch (error) {
    console.error('Upgrade failed with error:', error);
    throw error;
  }

  console.log(
    'EnergyToken proxy address (unchanged):',
    await upgradedContract.getAddress(),
  );

  // Wait for a few more confirmations to ensure the upgrade is fully propagated
  console.log('Waiting for additional confirmations...');
  await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

  console.log('Upgrade process completed!');

  // Optional: Verify the decimals are now 6
  try {
    const decimals = await upgradedContract.decimals();
    console.log('✅ Token decimals:', decimals.toString());
    if (decimals.toString() === '6') {
      console.log('✅ Decimals correctly set to 6 (USDC standard)');
    } else {
      console.log('⚠️  Warning: Decimals are not 6, got:', decimals.toString());
    }
  } catch (error) {
    console.log('Could not verify decimals:', error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
