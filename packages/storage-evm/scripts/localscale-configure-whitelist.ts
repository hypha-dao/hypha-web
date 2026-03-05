import { ethers } from 'hardhat';

/**
 * Enables the transfer whitelist on the LocalScale ownership token and
 * adds a specific address to the whitelist so it can freely transfer tokens.
 *
 * Usage:
 *   npx hardhat run scripts/localscale-configure-whitelist.ts --network base-mainnet
 */

const TOKEN_ADDRESS = '0x085a2bd60b5c786aDdf1cF87D72735ae4974D90b';
const ADDRESS_TO_WHITELIST = '0xEA9dE72f519aF9C66e7EBAAC0CE024a34Dd07427';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const adminAddress = await deployer.getAddress();

  console.log('='.repeat(60));
  console.log('LOCALSCALE WHITELIST CONFIGURATION');
  console.log('='.repeat(60));
  console.log(`Admin address: ${adminAddress}`);
  console.log(`Token address: ${TOKEN_ADDRESS}`);
  console.log(`Address to whitelist: ${ADDRESS_TO_WHITELIST}`);
  console.log('');

  const token = await ethers.getContractAt(
    'LocalScaleOwnershipToken',
    TOKEN_ADDRESS,
  );

  // ── Step 1: Enable transfer whitelist ──
  const currentUseTransferWhitelist = await token.useTransferWhitelist();
  console.log(`Current useTransferWhitelist: ${currentUseTransferWhitelist}`);

  if (!currentUseTransferWhitelist) {
    console.log('Enabling transfer whitelist...');
    const tx1 = await token.setUseTransferWhitelist(true);
    await tx1.wait();
    console.log('✅ Transfer whitelist enabled');
  } else {
    console.log('ℹ️  Transfer whitelist already enabled, skipping');
  }

  // ── Step 2: Add address to transfer whitelist ──
  const alreadyWhitelisted = await token.canTransfer(ADDRESS_TO_WHITELIST);
  console.log(
    `\nCurrent canTransfer(${ADDRESS_TO_WHITELIST}): ${alreadyWhitelisted}`,
  );

  if (!alreadyWhitelisted) {
    console.log('Adding address to transfer whitelist...');
    const tx2 = await token.batchSetTransferWhitelist(
      [ADDRESS_TO_WHITELIST],
      [true],
    );
    await tx2.wait();
    console.log('✅ Address added to transfer whitelist');
  } else {
    console.log('ℹ️  Address already whitelisted, skipping');
  }

  // ── Verification ──
  console.log('\n' + '='.repeat(60));
  console.log('VERIFICATION');
  console.log('='.repeat(60));

  const finalUseTransferWhitelist = await token.useTransferWhitelist();
  const finalCanTransfer = await token.canTransfer(ADDRESS_TO_WHITELIST);
  const canAccountTransferResult = await token.canAccountTransfer(
    ADDRESS_TO_WHITELIST,
  );

  console.log(`useTransferWhitelist: ${finalUseTransferWhitelist}`);
  console.log(`canTransfer(${ADDRESS_TO_WHITELIST}): ${finalCanTransfer}`);
  console.log(
    `canAccountTransfer(${ADDRESS_TO_WHITELIST}): ${canAccountTransferResult}`,
  );

  if (finalUseTransferWhitelist && finalCanTransfer) {
    console.log(
      '\n✅ Configuration complete! The address can now transfer tokens.',
    );
  } else {
    console.log('\n⚠️  Something may not have been configured correctly.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
