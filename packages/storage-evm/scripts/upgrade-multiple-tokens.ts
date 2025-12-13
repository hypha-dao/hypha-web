import { ethers, upgrades } from 'hardhat';
import fs from 'fs';
import path from 'path';

/**
 * Script to upgrade multiple token contracts with new implementations
 *
 * Usage:
 * 1. Edit the TOKEN_TYPE to specify which type of token to upgrade
 * 2. Edit the TOKEN_ADDRESSES array to specify which tokens to upgrade
 * 3. Run: npx hardhat run scripts/base-mainnet-contracts-scripts/upgrade-multiple-tokens.ts --network base-mainnet
 *
 * You can also load addresses from a file (see loadAddressesFromFile function)
 */

// ============== CONFIGURATION ==============

// Token type to upgrade: 'Regular', 'Ownership', or 'Decaying'
const TOKEN_TYPE: 'Regular' | 'Ownership' | 'Decaying' = 'Regular';

// Token addresses to upgrade (edit this array or load from file)
const TOKEN_ADDRESSES: string[] = [''];

// Set to true to load addresses from a file instead of using TOKEN_ADDRESSES array
const LOAD_FROM_FILE = true;
const ADDRESS_FILE_PATH =
  '/Users/vlad/hypha-web/packages/storage-evm/scripts/base-mainnet-contracts-scripts/token-upgrade-data/regular-addresses-2025-11-14T09-30-58-747Z.txt';

// Set to true to perform a dry run (prepare upgrade but don't execute)
const DRY_RUN = false; // Start with dry run for testing

// Wait time between upgrades (in milliseconds) to avoid rate limiting
const WAIT_TIME_BETWEEN_UPGRADES = 5000;

// ============================================

interface UpgradeResult {
  tokenAddress: string;
  success: boolean;
  oldImplementation: string | null;
  newImplementation: string | null;
  error: string | null;
}

function getContractName(tokenType: string): string {
  switch (tokenType) {
    case 'Regular':
      return 'RegularSpaceToken';
    case 'Ownership':
      return 'OwnershipSpaceToken';
    case 'Decaying':
      return 'DecayingSpaceToken';
    default:
      throw new Error(`Unknown token type: ${tokenType}`);
  }
}

function loadAddressesFromFile(filePath: string): string[] {
  const absolutePath = path.resolve(__dirname, filePath);
  console.log(`Loading addresses from: ${absolutePath}`);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`File not found: ${absolutePath}`);
  }

  const content = fs.readFileSync(absolutePath, 'utf-8');
  const addresses = content
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && line.startsWith('0x'));

  console.log(`Loaded ${addresses.length} addresses from file`);
  return addresses;
}

async function upgradeToken(
  tokenAddress: string,
  contractFactory: any,
  dryRun: boolean,
): Promise<UpgradeResult> {
  const result: UpgradeResult = {
    tokenAddress,
    success: false,
    oldImplementation: null,
    newImplementation: null,
    error: null,
  };

  try {
    // Get current implementation address
    result.oldImplementation = await upgrades.erc1967.getImplementationAddress(
      tokenAddress,
    );
    console.log(`  Current implementation: ${result.oldImplementation}`);

    if (dryRun) {
      console.log('  🔍 DRY RUN: Preparing upgrade...');
      const preparedImpl = await upgrades.prepareUpgrade(
        tokenAddress,
        contractFactory,
        {
          // Storage check enabled for safety
          // Will verify that new variables don't corrupt existing storage
        },
      );
      console.log(
        `  ✅ DRY RUN: Would deploy new implementation at: ${preparedImpl}`,
      );

      // Check if implementation would actually change
      if (
        result.oldImplementation?.toLowerCase() ===
        preparedImpl.toString().toLowerCase()
      ) {
        console.log(
          '  ℹ️  DRY RUN: Implementation would be unchanged (already upgraded)',
        );
      } else {
        console.log('  ✅ DRY RUN: Implementation would change!');
      }

      console.log(
        '  🔍 DRY RUN: Would configure autoMinting=true after upgrade',
      );
      result.newImplementation = preparedImpl.toString();
      result.success = true;
      return result;
    }

    console.log('  🔄 Upgrading...');

    let upgradedContract;
    try {
      // Get current gas price from network
      const provider = ethers.provider;
      const feeData = await provider.getFeeData();

      // Increase gas price by 200% (3x) to avoid underpriced transactions
      // This is necessary when there are stuck/pending transactions in mempool
      const maxFeePerGas = feeData.maxFeePerGas
        ? (feeData.maxFeePerGas * 300n) / 100n
        : undefined;
      const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
        ? (feeData.maxPriorityFeePerGas * 300n) / 100n
        : undefined;

      console.log('  ⛽ Gas settings:');
      if (maxFeePerGas) {
        console.log(
          `     Max fee: ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei`,
        );
      }
      if (maxPriorityFeePerGas) {
        console.log(
          `     Priority fee: ${ethers.formatUnits(
            maxPriorityFeePerGas,
            'gwei',
          )} gwei`,
        );
      }

      // Try to upgrade with increased gas and storage validation
      upgradedContract = await upgrades.upgradeProxy(
        tokenAddress,
        contractFactory,
        {
          // Storage check enabled for safety
          txOverrides: {
            maxFeePerGas,
            maxPriorityFeePerGas,
          },
        },
      );

      console.log('  ⏳ Waiting for deployment to complete...');
      await upgradedContract.waitForDeployment();
      console.log('  ✅ Deployment complete');
    } catch (error: any) {
      // Check if the error is about unregistered deployment
      if (error.message.includes('is not registered')) {
        console.log('  ⚠️  Proxy not registered. Importing and retrying...');

        // Force import the existing proxy
        await upgrades.forceImport(tokenAddress, contractFactory);
        console.log('  ✅ Proxy imported successfully');

        // Retry the upgrade with same gas settings and storage validation
        upgradedContract = await upgrades.upgradeProxy(
          tokenAddress,
          contractFactory,
          {
            // Storage check enabled for safety
            txOverrides: {
              maxFeePerGas,
              maxPriorityFeePerGas,
            },
          },
        );

        console.log('  ⏳ Waiting for deployment to complete...');
        await upgradedContract.waitForDeployment();
        console.log('  ✅ Deployment complete');
      } else if (
        error.message.includes('replacement transaction underpriced')
      ) {
        console.error('  ❌ Replacement transaction underpriced');
        console.error(
          '  ℹ️  This means there is a pending transaction with the same nonce.',
        );
        console.error(
          '  ℹ️  Please wait 10-15 minutes or cancel pending transactions.',
        );
        console.error(
          '  ℹ️  Run: npx nx run storage-evm:script ./scripts/check-pending-txs.ts --network base-mainnet',
        );
        throw error;
      } else {
        throw error;
      }
    }

    // Wait a moment for blockchain state to propagate
    console.log(
      '  ⏳ Waiting for blockchain state to propagate (3 seconds)...',
    );
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // Get new implementation address
    result.newImplementation = await upgrades.erc1967.getImplementationAddress(
      tokenAddress,
    );
    console.log(`  New implementation: ${result.newImplementation}`);

    // Verify the upgrade actually happened
    const implementationChanged =
      result.oldImplementation?.toLowerCase() !==
      result.newImplementation?.toLowerCase();

    if (!implementationChanged) {
      console.log('  ℹ️  Implementation address unchanged (already upgraded)');
    } else {
      console.log('  ✅ Successfully upgraded!');
    }

    // Post-upgrade configuration: Enable autoMinting for backward compatibility
    // This runs whether or not the implementation changed
    console.log('  🔧 Configuring post-upgrade settings...');
    try {
      const tokenContract = await ethers.getContractAt(
        'RegularSpaceToken',
        tokenAddress,
      );

      // Check current autoMinting status
      const currentAutoMinting = await tokenContract.autoMinting();
      console.log(`  Current autoMinting: ${currentAutoMinting}`);

      if (!currentAutoMinting) {
        console.log('  Setting autoMinting to true...');
        const configTx = await tokenContract.setAutoMinting(true);
        await configTx.wait();
        console.log('  ✅ AutoMinting enabled (backward compatibility)');
      } else {
        console.log('  ℹ️  AutoMinting already enabled, skipping');
      }

      result.success = true;
    } catch (configError: any) {
      console.log(
        `  ⚠️  Warning: Could not configure autoMinting: ${configError.message}`,
      );
      console.log('  ℹ️  You may need to call setAutoMinting(true) manually');
      // Mark as success if implementation changed, otherwise keep as false
      result.success = implementationChanged;
      if (!result.success) {
        result.error = 'Implementation unchanged and autoMinting config failed';
      }
    }
  } catch (error: any) {
    console.error(`  ❌ Error: ${error.message}`);
    result.error = error.message;
    result.success = false;
  }

  return result;
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('TOKEN UPGRADE SCRIPT');
  console.log('='.repeat(70));

  // Get deployer info
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();
  console.log(`\nAdmin address: ${adminAddress}`);
  console.log(`Token type: ${TOKEN_TYPE}`);
  console.log(`Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);

  // Load addresses
  let addresses: string[];
  if (LOAD_FROM_FILE) {
    addresses = loadAddressesFromFile(ADDRESS_FILE_PATH);
  } else {
    addresses = TOKEN_ADDRESSES;
  }

  if (addresses.length === 0) {
    console.error(
      '\n❌ No token addresses provided! Please edit the TOKEN_ADDRESSES array or set LOAD_FROM_FILE=true',
    );
    process.exit(1);
  }

  console.log(`\nTokens to upgrade: ${addresses.length}`);
  console.log('\nAddresses:');
  addresses.forEach((addr, idx) => {
    console.log(`  ${idx + 1}. ${addr}`);
  });

  // Get contract factory
  const contractName = getContractName(TOKEN_TYPE);
  console.log(`\nLoading contract factory: ${contractName}`);
  const ContractFactory = await ethers.getContractFactory(contractName);
  console.log('Contract factory loaded successfully');

  // Confirm before proceeding (unless dry run)
  if (!DRY_RUN) {
    console.log('\n⚠️  WARNING: This will upgrade the following contracts:');
    console.log(`   Type: ${TOKEN_TYPE}`);
    console.log(`   Count: ${addresses.length}`);
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('\nProceeding with upgrades...\n');
  }

  // Track results
  const results: UpgradeResult[] = [];
  const startTime = Date.now();

  // Upgrade each token
  for (let i = 0; i < addresses.length; i++) {
    const tokenAddress = addresses[i];
    console.log(
      `\n[${i + 1}/${addresses.length}] Upgrading token: ${tokenAddress}`,
    );

    const result = await upgradeToken(tokenAddress, ContractFactory, DRY_RUN);
    results.push(result);

    // Wait between upgrades to avoid rate limiting (except for last one)
    if (i < addresses.length - 1 && !DRY_RUN) {
      console.log(
        `  ⏳ Waiting ${
          WAIT_TIME_BETWEEN_UPGRADES / 1000
        } seconds before next upgrade...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, WAIT_TIME_BETWEEN_UPGRADES),
      );
    }
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('UPGRADE SUMMARY');
  console.log('='.repeat(70));

  const successfulUpgrades = results.filter((r) => r.success);
  const failedUpgrades = results.filter((r) => !r.success);

  console.log(`\nTotal tokens processed: ${results.length}`);
  console.log(`Successful upgrades: ${successfulUpgrades.length}`);
  console.log(`Failed upgrades: ${failedUpgrades.length}`);
  console.log(`Total time: ${totalTime} seconds`);

  if (successfulUpgrades.length > 0) {
    console.log('\n✅ Successfully upgraded:');
    successfulUpgrades.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.tokenAddress}`);
      console.log(`     Old impl: ${result.oldImplementation}`);
      console.log(`     New impl: ${result.newImplementation}`);
    });
  }

  if (failedUpgrades.length > 0) {
    console.log('\n❌ Failed upgrades:');
    failedUpgrades.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.tokenAddress}`);
      console.log(`     Error: ${result.error}`);
    });
  }

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'token-upgrade-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resultsFile = path.join(
    outputDir,
    `upgrade-results-${TOKEN_TYPE.toLowerCase()}-${timestamp}.json`,
  );
  fs.writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        tokenType: TOKEN_TYPE,
        dryRun: DRY_RUN,
        timestamp: new Date().toISOString(),
        totalTime: totalTime,
        results,
      },
      null,
      2,
    ),
  );
  console.log(`\n📄 Results saved to: ${resultsFile}`);

  if (failedUpgrades.length > 0) {
    console.log('\n⚠️  Some upgrades failed. Please review the errors above.');
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n✅ Upgrade script completed successfully');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Upgrade script failed:', error);
    process.exit(1);
  });
