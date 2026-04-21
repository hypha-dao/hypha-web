import { ethers } from 'hardhat';

async function main(): Promise<void> {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();

  console.log('Checking pending transactions for:', deployerAddress);
  console.log('='.repeat(60));

  // Check current nonces
  const latestNonce = await deployer.getNonce('latest');
  const pendingNonce = await deployer.getNonce('pending');

  console.log('\nNonce Status:');
  console.log('  Latest confirmed nonce:', latestNonce);
  console.log('  Next pending nonce:    ', pendingNonce);

  const pendingCount = pendingNonce - latestNonce;

  if (pendingCount === 0) {
    console.log('\n✅ No pending transactions - all clear!');
    console.log('You can safely run the upgrade script now.');
  } else {
    console.log(`\n⚠️  Found ${pendingCount} pending transaction(s)`);
    console.log(`   Stuck nonces: ${latestNonce} to ${pendingNonce - 1}`);

    console.log('\n📋 Options to resolve:');
    console.log('  1. Wait 10-15 minutes for transactions to confirm or drop');
    console.log('  2. Cancel them manually with higher gas (see canceltrx.ts)');
    console.log('  3. Check on BaseScan:');
    console.log(`     https://basescan.org/address/${deployerAddress}`);

    console.log('\n💡 To cancel all pending transactions:');
    console.log('   1. Edit canceltrx.ts and set stuckNonce to:', latestNonce);
    console.log(
      '   2. Run: npx nx run storage-evm:script ./scripts/canceltrx.ts --network base-mainnet',
    );
    console.log('   3. Repeat for each pending transaction if needed');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error('Error:', error);
    process.exit(1);
  });
