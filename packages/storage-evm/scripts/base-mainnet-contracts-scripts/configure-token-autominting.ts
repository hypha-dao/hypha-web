import { ethers } from 'hardhat';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

/**
 * Script to configure autoMinting on upgraded tokens
 *
 * This script sets autoMinting=true on RegularSpaceToken contracts
 * to maintain backward compatibility after upgrading from the old version.
 *
 * Usage:
 * 1. Edit the TOKEN_ADDRESSES array with tokens to configure
 * 2. Run: npx hardhat run scripts/base-mainnet-contracts-scripts/configure-token-autominting.ts --network base-mainnet
 *
 * Or pass addresses as command line arguments:
 * npx hardhat run scripts/base-mainnet-contracts-scripts/configure-token-autominting.ts --network base-mainnet -- 0x123... 0x456...
 *
 * Or load from a file by setting LOAD_FROM_FILE=true
 */

// ============== CONFIGURATION ==============

// Token addresses to configure (edit this array)
const TOKEN_ADDRESSES: string[] = [
  // Example addresses - replace with actual addresses
  // '0x1234567890123456789012345678901234567890',
];

// Set to true to load addresses from a file instead
const LOAD_FROM_FILE = false;
const ADDRESS_FILE_PATH = './token-upgrade-data/regular-addresses-latest.txt';

// Set to true to perform a dry run (check status without updating)
const DRY_RUN = false;

// Wait time between operations (in milliseconds)
const WAIT_TIME_BETWEEN_OPS = 2000;

// ============================================

interface ConfigResult {
  tokenAddress: string;
  success: boolean;
  wasAlreadyEnabled: boolean;
  error: string | null;
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

async function configureToken(
  tokenAddress: string,
  dryRun: boolean,
): Promise<ConfigResult> {
  const result: ConfigResult = {
    tokenAddress,
    success: false,
    wasAlreadyEnabled: false,
    error: null,
  };

  try {
    // Get token contract
    const token = await ethers.getContractAt('RegularSpaceToken', tokenAddress);

    // Check current autoMinting status
    const currentAutoMinting = await token.autoMinting();
    console.log(`  Current autoMinting: ${currentAutoMinting}`);

    if (currentAutoMinting) {
      console.log('  ℹ️  AutoMinting already enabled, skipping');
      result.wasAlreadyEnabled = true;
      result.success = true;
      return result;
    }

    if (dryRun) {
      console.log('  🔍 DRY RUN: Would set autoMinting to true');
      result.success = true;
      return result;
    }

    // Set autoMinting to true
    console.log('  🔧 Setting autoMinting to true...');
    const tx = await token.setAutoMinting(true);
    await tx.wait();

    // Verify the change
    const newAutoMinting = await token.autoMinting();
    if (newAutoMinting) {
      console.log('  ✅ AutoMinting successfully enabled');
      result.success = true;
    } else {
      console.log('  ⚠️  Warning: AutoMinting still appears to be false');
      result.error = 'AutoMinting was not enabled';
      result.success = false;
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
  console.log('TOKEN AUTO-MINTING CONFIGURATION SCRIPT');
  console.log('='.repeat(70));

  // Get signer info
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log(`\nSigner address: ${signerAddress}`);
  console.log(`Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);

  // Load addresses
  let addresses: string[];

  // Check for command line arguments
  const args = process.argv.slice(2);
  const addressArgs = args.filter((arg) => arg.startsWith('0x'));

  if (addressArgs.length > 0) {
    addresses = addressArgs;
    console.log(`\nUsing ${addresses.length} addresses from command line`);
  } else if (LOAD_FROM_FILE) {
    addresses = loadAddressesFromFile(ADDRESS_FILE_PATH);
  } else {
    addresses = TOKEN_ADDRESSES;
    console.log(
      `\nUsing ${addresses.length} addresses from TOKEN_ADDRESSES array`,
    );
  }

  if (addresses.length === 0) {
    console.error(
      '\n❌ No token addresses provided! Please:',
      '\n  - Edit TOKEN_ADDRESSES array in the script',
      '\n  - Pass addresses as command line arguments',
      '\n  - Use LOAD_FROM_FILE=true with ADDRESS_FILE_PATH',
    );
    process.exit(1);
  }

  console.log(`\nTokens to configure: ${addresses.length}`);
  console.log('\nAddresses:');
  addresses.forEach((addr, idx) => {
    console.log(`  ${idx + 1}. ${addr}`);
  });

  // Confirm before proceeding (unless dry run)
  if (!DRY_RUN) {
    console.log(
      '\n⚠️  WARNING: This will set autoMinting=true on these tokens',
    );
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('\nProceeding with configuration...\n');
  }

  // Track results
  const results: ConfigResult[] = [];
  const startTime = Date.now();

  // Configure each token
  for (let i = 0; i < addresses.length; i++) {
    const tokenAddress = addresses[i];
    console.log(
      `\n[${i + 1}/${addresses.length}] Configuring token: ${tokenAddress}`,
    );

    const result = await configureToken(tokenAddress, DRY_RUN);
    results.push(result);

    // Wait between operations (except for last one)
    if (i < addresses.length - 1 && !DRY_RUN) {
      console.log(
        `  ⏳ Waiting ${
          WAIT_TIME_BETWEEN_OPS / 1000
        } seconds before next token...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, WAIT_TIME_BETWEEN_OPS),
      );
    }
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('CONFIGURATION SUMMARY');
  console.log('='.repeat(70));

  const successful = results.filter((r) => r.success);
  const alreadyEnabled = results.filter((r) => r.wasAlreadyEnabled);
  const newlyEnabled = results.filter((r) => r.success && !r.wasAlreadyEnabled);
  const failed = results.filter((r) => !r.success);

  console.log(`\nTotal tokens processed: ${results.length}`);
  console.log(`Successfully configured: ${successful.length}`);
  console.log(`  - Already enabled: ${alreadyEnabled.length}`);
  console.log(`  - Newly enabled: ${newlyEnabled.length}`);
  console.log(`Failed: ${failed.length}`);
  console.log(`Total time: ${totalTime} seconds`);

  if (newlyEnabled.length > 0) {
    console.log('\n✅ Newly enabled autoMinting:');
    newlyEnabled.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.tokenAddress}`);
    });
  }

  if (alreadyEnabled.length > 0) {
    console.log('\nℹ️  Already had autoMinting enabled:');
    alreadyEnabled.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.tokenAddress}`);
    });
  }

  if (failed.length > 0) {
    console.log('\n❌ Failed configurations:');
    failed.forEach((result, idx) => {
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
    `autominting-config-results-${timestamp}.json`,
  );
  fs.writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        dryRun: DRY_RUN,
        timestamp: new Date().toISOString(),
        totalTime: totalTime,
        results,
        summary: {
          total: results.length,
          successful: successful.length,
          alreadyEnabled: alreadyEnabled.length,
          newlyEnabled: newlyEnabled.length,
          failed: failed.length,
        },
      },
      null,
      2,
    ),
  );
  console.log(`\n📄 Results saved to: ${resultsFile}`);

  if (failed.length > 0) {
    console.log(
      '\n⚠️  Some configurations failed. Please review the errors above.',
    );
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n✅ Configuration script completed successfully');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Configuration script failed:', error);
    process.exit(1);
  });
