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
const TOKEN_ADDRESSES: string[] = [
  // Example addresses - replace with actual addresses
  // '0x1234567890123456789012345678901234567890',
  // '0x2345678901234567890123456789012345678901',
];

// Set to true to load addresses from a file instead of using TOKEN_ADDRESSES array
const LOAD_FROM_FILE = false;
const ADDRESS_FILE_PATH = './token-upgrade-data/regular-addresses-latest.txt';

// Set to true to perform a dry run (prepare upgrade but don't execute)
const DRY_RUN = false;

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
          unsafeSkipStorageCheck: true,
        },
      );
      console.log(
        `  ✅ DRY RUN: Would deploy new implementation at: ${preparedImpl}`,
      );
      result.newImplementation = preparedImpl.toString();
      result.success = true;
      return result;
    }

    console.log('  🔄 Upgrading...');

    let upgradedContract;
    try {
      // Try to upgrade
      upgradedContract = await upgrades.upgradeProxy(
        tokenAddress,
        contractFactory,
        {
          unsafeSkipStorageCheck: true,
        },
      );

      await upgradedContract.waitForDeployment();
    } catch (error: any) {
      // Check if the error is about unregistered deployment
      if (error.message.includes('is not registered')) {
        console.log('  ⚠️  Proxy not registered. Importing and retrying...');

        // Force import the existing proxy
        await upgrades.forceImport(tokenAddress, contractFactory);
        console.log('  ✅ Proxy imported successfully');

        // Retry the upgrade
        upgradedContract = await upgrades.upgradeProxy(
          tokenAddress,
          contractFactory,
          {
            unsafeSkipStorageCheck: true,
          },
        );

        await upgradedContract.waitForDeployment();
      } else {
        throw error;
      }
    }

    // Get new implementation address
    result.newImplementation = await upgrades.erc1967.getImplementationAddress(
      tokenAddress,
    );
    console.log(`  New implementation: ${result.newImplementation}`);

    // Verify the upgrade actually happened
    if (
      result.oldImplementation?.toLowerCase() ===
      result.newImplementation?.toLowerCase()
    ) {
      console.log(
        '  ⚠️  WARNING: Implementation address did not change! Upgrade may have failed.',
      );
      result.error = 'Implementation address did not change';
      result.success = false;
    } else {
      console.log('  ✅ Successfully upgraded!');
      result.success = true;
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
