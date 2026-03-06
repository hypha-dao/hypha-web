import { ethers } from 'hardhat';

// CONFIGURATION: Set this to the specific nonce you want to cancel
// Or set to null to automatically use the current nonce
const SPECIFIC_NONCE: number | null = null;

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log('Canceling stuck transaction for address:', deployerAddress);
  console.log('='.repeat(60));

  // Check current nonces
  const latestNonce = await deployer.getNonce('latest');
  const pendingNonce = await deployer.getNonce('pending');

  console.log('\nNonce Status:');
  console.log('  Latest confirmed nonce:', latestNonce);
  console.log('  Next pending nonce:    ', pendingNonce);

  // Determine which nonce to cancel
  let nonceToCancel: number;

  if (SPECIFIC_NONCE !== null) {
    nonceToCancel = SPECIFIC_NONCE;
    console.log(`\n  Using specified nonce: ${nonceToCancel}`);
  } else if (pendingNonce > latestNonce) {
    // There are pending transactions
    nonceToCancel = latestNonce; // Cancel the first pending one
    console.log(
      `\n  Found pending transactions, will cancel nonce: ${nonceToCancel}`,
    );
  } else {
    // No pending transactions detected, but mempool might have stuck ones
    // Use the current nonce to force clear any mempool issues
    nonceToCancel = latestNonce;
    console.log(`\n  ⚠️  No pending transactions detected by wallet`);
    console.log(
      `  But mempool might have stuck transactions at nonce: ${nonceToCancel}`,
    );
    console.log(`  Will attempt to push through with high gas...`);
  }

  console.log(
    `\n🔄 Attempting to cancel/replace transaction at nonce ${nonceToCancel}`,
  );
  console.log('   Strategy: Send 0 ETH to yourself with high gas');

  // Get current gas prices and multiply by 20x to ensure override
  // Using 20x because even 5x was not enough - there are very high gas transactions stuck
  const feeData = await ethers.provider.getFeeData();
  const baseMaxFee = feeData.maxFeePerGas || ethers.parseUnits('1', 'gwei');
  const basePriorityFee =
    feeData.maxPriorityFeePerGas || ethers.parseUnits('0.1', 'gwei');

  const gasMultiplier = 2000n; // 20x
  const maxFeePerGas = (baseMaxFee * gasMultiplier) / 100n;
  const maxPriorityFeePerGas = (basePriorityFee * gasMultiplier) / 100n;

  console.log('\n⛽ Gas Settings (20x network average - AGGRESSIVE):');
  console.log(
    `   Max fee per gas:      ${ethers.formatUnits(maxFeePerGas, 'gwei')} gwei`,
  );
  console.log(
    `   Max priority fee:     ${ethers.formatUnits(
      maxPriorityFeePerGas,
      'gwei',
    )} gwei`,
  );
  console.log('   ⚠️  Using very high gas to override stuck transactions');

  try {
    // Send 0 ETH to yourself with very high gas to replace stuck transaction
    const cancelTx = await deployer.sendTransaction({
      to: deployerAddress, // Send to yourself
      value: 0, // 0 ETH
      nonce: nonceToCancel, // Use the target nonce
      maxFeePerGas,
      maxPriorityFeePerGas,
      gasLimit: 21000, // Standard transfer gas limit
    });

    console.log('\n📤 Cancellation transaction sent!');
    console.log('   Transaction hash:', cancelTx.hash);
    console.log('   BaseScan: https://basescan.org/tx/' + cancelTx.hash);
    console.log('\n⏳ Waiting for confirmation...');

    const receipt = await cancelTx.wait();
    console.log('\n✅ Cancellation transaction confirmed!');
    console.log('   Block number:', receipt?.blockNumber);
    console.log('   Gas used:', receipt?.gasUsed.toString());

    // Check nonces after cancellation
    const newLatestNonce = await deployer.getNonce('latest');
    const newPendingNonce = await deployer.getNonce('pending');

    console.log('\n📊 Updated Nonce Status:');
    console.log('   Latest nonce:', newLatestNonce);
    console.log('   Pending nonce:', newPendingNonce);

    if (newLatestNonce === newPendingNonce) {
      console.log('\n✅ SUCCESS! No more pending transactions.');
      console.log('   You can now run your upgrade script!');
    } else {
      console.log('\n⚠️  Still have pending transactions.');
      console.log(`   Run this script again to cancel nonce ${newLatestNonce}`);
    }
  } catch (error: any) {
    console.error('\n❌ Error canceling transaction:', error.message);

    if (error.message.includes('nonce has already been used')) {
      console.log(
        '\nℹ️  This nonce was already used. The transaction may have confirmed.',
      );
      console.log('   Check BaseScan to verify.');
    } else if (error.message.includes('replacement transaction underpriced')) {
      console.log(
        '\nℹ️  Even 5x gas was not enough. There might be a very high gas transaction pending.',
      );
      console.log('   Try waiting 15-30 minutes for it to clear.');
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error('Error canceling transaction:', error);
    process.exit(1);
  });
