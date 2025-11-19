import { ethers } from 'hardhat';
import fs from 'fs';
import path from 'path';

/**
 * Script to set transfer helper address for multiple token contracts
 *
 * Usage:
 * 1. Edit the TOKEN_TYPE to specify which type of token to update
 * 2. Edit the TRANSFER_HELPER_ADDRESS to the new transfer helper address
 * 3. Edit the TOKEN_ADDRESSES array to specify which tokens to update
 * 4. Run: npx hardhat run scripts/set-transfer-helper-multiple-tokens.ts --network base-mainnet
 *
 * You can also load addresses from a file (see loadAddressesFromFile function)
 */

// ============== CONFIGURATION ==============

// Token type: 'Regular', 'Ownership', or 'Decaying'
const TOKEN_TYPE: 'Regular' | 'Ownership' | 'Decaying' = 'Regular';

// The new transfer helper address to set
const TRANSFER_HELPER_ADDRESS = '0x479002F7602579203ffba3eE84ACC1BC5b0d6785';

// Token addresses to update (edit this array or load from file)
const TOKEN_ADDRESSES: string[] = [''];

// Set to true to load addresses from a file instead of using TOKEN_ADDRESSES array
const LOAD_FROM_FILE = true;
const ADDRESS_FILE_PATH =
  '/Users/vlad/hypha-web/packages/storage-evm/scripts/base-mainnet-contracts-scripts/token-upgrade-data/regular-addresses-2025-11-14T09-30-58-747Z.txt';
// Set to true to perform a dry run (check current values but don't execute)
const DRY_RUN = false; // Start with dry run for testing

// Wait time between updates (in milliseconds) to avoid rate limiting
const WAIT_TIME_BETWEEN_UPDATES = 2000;

// ============================================

interface UpdateResult {
  tokenAddress: string;
  success: boolean;
  oldTransferHelper: string | null;
  newTransferHelper: string | null;
  error: string | null;
  skipped: boolean; // true if already set to target address
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
  const absolutePath = path.resolve(filePath);
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

async function setTransferHelper(
  tokenAddress: string,
  newTransferHelper: string,
  contractName: string,
  dryRun: boolean,
): Promise<UpdateResult> {
  const result: UpdateResult = {
    tokenAddress,
    success: false,
    oldTransferHelper: null,
    newTransferHelper: null,
    error: null,
    skipped: false,
  };

  try {
    // Get token contract instance
    const tokenContract = await ethers.getContractAt(
      contractName,
      tokenAddress,
    );

    // Get current transfer helper address
    result.oldTransferHelper = await tokenContract.transferHelper();
    console.log(`  Current transfer helper: ${result.oldTransferHelper}`);

    // Check if already set to target address
    if (
      result.oldTransferHelper.toLowerCase() === newTransferHelper.toLowerCase()
    ) {
      console.log(
        '  ℹ️  Transfer helper already set to target address, skipping',
      );
      result.skipped = true;
      result.success = true;
      result.newTransferHelper = result.oldTransferHelper;
      return result;
    }

    if (dryRun) {
      console.log(
        '  🔍 DRY RUN: Would set transfer helper to:',
        newTransferHelper,
      );
      result.newTransferHelper = newTransferHelper;
      result.success = true;
      return result;
    }

    console.log('  🔄 Setting transfer helper...');

    // Get current gas price from network
    const provider = ethers.provider;
    const feeData = await provider.getFeeData();

    // Increase gas price by 50% to ensure transaction goes through
    const maxFeePerGas = feeData.maxFeePerGas
      ? (feeData.maxFeePerGas * 150n) / 100n
      : undefined;
    const maxPriorityFeePerGas = feeData.maxPriorityFeePerGas
      ? (feeData.maxPriorityFeePerGas * 150n) / 100n
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

    // Set transfer helper
    const tx = await tokenContract.setTransferHelper(newTransferHelper, {
      maxFeePerGas,
      maxPriorityFeePerGas,
    });

    console.log(`  ⏳ Transaction sent: ${tx.hash}`);
    console.log('  ⏳ Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log(`  ✅ Transaction confirmed in block ${receipt.blockNumber}`);

    // Verify the change
    result.newTransferHelper = await tokenContract.transferHelper();
    console.log(`  New transfer helper: ${result.newTransferHelper}`);

    if (
      result.newTransferHelper.toLowerCase() === newTransferHelper.toLowerCase()
    ) {
      console.log('  ✅ Successfully updated transfer helper!');
      result.success = true;
    } else {
      console.log(
        '  ⚠️  Warning: Transfer helper does not match expected value',
      );
      result.error = 'Transfer helper verification failed';
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
  console.log('SET TRANSFER HELPER SCRIPT');
  console.log('='.repeat(70));

  // Get deployer/executor info
  const [signer] = await ethers.getSigners();
  const signerAddress = await signer.getAddress();
  console.log(`\nSigner address: ${signerAddress}`);
  console.log(`Token type: ${TOKEN_TYPE}`);
  console.log(`Target transfer helper: ${TRANSFER_HELPER_ADDRESS}`);
  console.log(`Dry run: ${DRY_RUN ? 'YES' : 'NO'}`);

  // Validate transfer helper address
  if (!ethers.isAddress(TRANSFER_HELPER_ADDRESS)) {
    console.error('\n❌ Invalid transfer helper address!');
    process.exit(1);
  }

  // Load addresses
  let addresses: string[];
  if (LOAD_FROM_FILE) {
    addresses = loadAddressesFromFile(ADDRESS_FILE_PATH);
  } else {
    addresses = TOKEN_ADDRESSES;
  }

  if (addresses.length === 0 || addresses[0] === '') {
    console.error(
      '\n❌ No token addresses provided! Please edit the TOKEN_ADDRESSES array or set LOAD_FROM_FILE=true',
    );
    process.exit(1);
  }

  console.log(`\nTokens to update: ${addresses.length}`);
  console.log('\nAddresses:');
  addresses.forEach((addr, idx) => {
    console.log(`  ${idx + 1}. ${addr}`);
  });

  // Get contract name
  const contractName = getContractName(TOKEN_TYPE);
  console.log(`\nUsing contract type: ${contractName}`);

  // Confirm before proceeding (unless dry run)
  if (!DRY_RUN) {
    console.log('\n⚠️  WARNING: This will update the following contracts:');
    console.log(`   Type: ${TOKEN_TYPE}`);
    console.log(`   Count: ${addresses.length}`);
    console.log(`   New transfer helper: ${TRANSFER_HELPER_ADDRESS}`);
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to continue...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
    console.log('\nProceeding with updates...\n');
  }

  // Track results
  const results: UpdateResult[] = [];
  const startTime = Date.now();

  // Update each token
  for (let i = 0; i < addresses.length; i++) {
    const tokenAddress = addresses[i];
    console.log(
      `\n[${i + 1}/${addresses.length}] Updating token: ${tokenAddress}`,
    );

    const result = await setTransferHelper(
      tokenAddress,
      TRANSFER_HELPER_ADDRESS,
      contractName,
      DRY_RUN,
    );
    results.push(result);

    // Wait between updates to avoid rate limiting (except for last one)
    if (i < addresses.length - 1 && !DRY_RUN) {
      console.log(
        `  ⏳ Waiting ${
          WAIT_TIME_BETWEEN_UPDATES / 1000
        } seconds before next update...`,
      );
      await new Promise((resolve) =>
        setTimeout(resolve, WAIT_TIME_BETWEEN_UPDATES),
      );
    }
  }

  const endTime = Date.now();
  const totalTime = ((endTime - startTime) / 1000).toFixed(2);

  // Print summary
  console.log('\n' + '='.repeat(70));
  console.log('UPDATE SUMMARY');
  console.log('='.repeat(70));

  const successfulUpdates = results.filter((r) => r.success && !r.skipped);
  const skippedUpdates = results.filter((r) => r.skipped);
  const failedUpdates = results.filter((r) => !r.success);

  console.log(`\nTotal tokens processed: ${results.length}`);
  console.log(`Successfully updated: ${successfulUpdates.length}`);
  console.log(`Skipped (already set): ${skippedUpdates.length}`);
  console.log(`Failed updates: ${failedUpdates.length}`);
  console.log(`Total time: ${totalTime} seconds`);

  if (successfulUpdates.length > 0) {
    console.log('\n✅ Successfully updated:');
    successfulUpdates.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.tokenAddress}`);
      console.log(`     Old: ${result.oldTransferHelper}`);
      console.log(`     New: ${result.newTransferHelper}`);
    });
  }

  if (skippedUpdates.length > 0) {
    console.log('\n⏭️  Skipped (already set correctly):');
    skippedUpdates.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.tokenAddress}`);
      console.log(`     Transfer helper: ${result.oldTransferHelper}`);
    });
  }

  if (failedUpdates.length > 0) {
    console.log('\n❌ Failed updates:');
    failedUpdates.forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.tokenAddress}`);
      console.log(`     Error: ${result.error}`);
    });
  }

  // Save results to file
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputDir = path.join(__dirname, 'token-transfer-helper-data');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const resultsFile = path.join(
    outputDir,
    `transfer-helper-results-${TOKEN_TYPE.toLowerCase()}-${timestamp}.json`,
  );
  fs.writeFileSync(
    resultsFile,
    JSON.stringify(
      {
        tokenType: TOKEN_TYPE,
        transferHelper: TRANSFER_HELPER_ADDRESS,
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

  if (failedUpdates.length > 0) {
    console.log('\n⚠️  Some updates failed. Please review the errors above.');
    process.exit(1);
  }
}

main()
  .then(() => {
    console.log('\n✅ Script completed successfully');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
