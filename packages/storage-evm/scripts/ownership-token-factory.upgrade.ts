import { ethers, upgrades } from 'hardhat';
import dotenv from 'dotenv';

dotenv.config();

// Replace this with your actual proxy address from addresses.txt
const PROXY_ADDRESS = '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6';

async function main(): Promise<void> {
  // Get the deployer's address (first account from the connected provider)
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log('🚀 Starting OwnershipTokenFactory upgrade...');
  console.log('Network:', await ethers.provider.getNetwork());
  console.log('Upgrading with address:', deployerAddress);
  console.log('Proxy address:', PROXY_ADDRESS);

  try {
    // Get the current implementation
    const OwnershipTokenFactory = await ethers.getContractFactory(
      'OwnershipTokenFactory',
    );

    // Check if we can read from the proxy first
    console.log('\n🔍 Verifying current proxy state...');
    const currentProxy = OwnershipTokenFactory.attach(PROXY_ADDRESS);

    try {
      const owner = await currentProxy.owner();
      console.log('Current owner:', owner);

      if (owner.toLowerCase() !== deployerAddress.toLowerCase()) {
        console.error('❌ Deployer is not the owner of the contract!');
        console.error(`Owner: ${owner}`);
        console.error(`Deployer: ${deployerAddress}`);
        throw new Error('Permission denied: only owner can upgrade');
      }
    } catch (error) {
      console.error('❌ Error reading current proxy:', error);
      throw error;
    }

    // Test if getSpaceToken function exists (should fail before upgrade if missing)
    console.log('\n🧪 Testing current getSpaceToken function...');
    try {
      await currentProxy.getSpaceToken(1);
      console.log(
        '⚠️ getSpaceToken already exists - upgrade may not be needed',
      );
    } catch (error) {
      console.log('✅ getSpaceToken missing as expected');
    }

    // Perform the upgrade
    console.log('\n⬆️ Performing upgrade...');

    try {
      // Try without force import first
      const upgradedContract = await upgrades.upgradeProxy(
        PROXY_ADDRESS,
        OwnershipTokenFactory,
      );

      await upgradedContract.waitForDeployment();
      console.log('✅ Upgrade successful!');

      // Test the new function
      console.log('\n🧪 Testing upgraded getSpaceToken function...');
      try {
        const result = await upgradedContract.getSpaceToken(1);
        console.log('✅ getSpaceToken now works! Result:', result);
      } catch (error) {
        console.log('❌ getSpaceToken still failing:', error);
      }

      console.log('\n🎉 OwnershipTokenFactory upgrade completed successfully!');
      console.log('Proxy address (unchanged):', PROXY_ADDRESS);
    } catch (upgradeError: any) {
      if (upgradeError.message.includes('not found')) {
        console.log(
          '⚠️ Proxy not found in upgrades manifest, trying force import...',
        );

        await upgrades.forceImport(PROXY_ADDRESS, OwnershipTokenFactory);
        console.log('✅ Force import successful');

        // Retry upgrade
        const upgradedContract = await upgrades.upgradeProxy(
          PROXY_ADDRESS,
          OwnershipTokenFactory,
        );

        await upgradedContract.waitForDeployment();
        console.log('✅ Upgrade successful after force import!');
      } else {
        throw upgradeError;
      }
    }
  } catch (error: any) {
    console.error('\n❌ Upgrade failed:', error.message);

    // Additional debugging info
    if (error.message.includes('Ownable')) {
      console.error(
        '💡 This might be an ownership issue. Check the contract owner.',
      );
    } else if (error.message.includes('proxy admin')) {
      console.error(
        '💡 This might be a proxy admin issue. Check the admin address.',
      );
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
