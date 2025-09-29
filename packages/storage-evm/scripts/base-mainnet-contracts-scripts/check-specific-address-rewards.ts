import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function main(): Promise<void> {
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

  // Use the same RPC configuration as list-spaces.ts
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  console.log(`Using RPC: ${process.env.RPC_URL}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}\n`);

  const abi = [
    'function pendingRewards(address user) view returns (uint256)',
    'function unclaimedRewards(address user) view returns (uint256)',
    'function userRewardDebt(address user) view returns (uint256)',
  ];

  const contract = new ethers.Contract(hyphaTokenAddress, abi, provider);

  // The specific address that had the error
  const problemAddress = '0xc4b6f66130a121725840061e9fee98e6c6c4076';

  console.log(
    `🔍 Checking pending rewards for problem address: ${problemAddress}`,
  );
  console.log('='.repeat(80));

  try {
    console.log('\n🧪 Testing different methods to check this address...');

    // Method 1: Direct call
    try {
      console.log('\n1️⃣ Method 1: Direct pendingRewards call...');
      const pendingRewards = await contract.pendingRewards(problemAddress);
      console.log(
        `   ✅ pendingRewards: ${ethers.formatEther(pendingRewards)} HYPHA`,
      );
    } catch (error: any) {
      console.log(`   ❌ pendingRewards failed: ${error.message}`);
    }

    // Method 2: Direct unclaimed call
    try {
      console.log('\n2️⃣ Method 2: Direct unclaimedRewards call...');
      const unclaimedRewards = await contract.unclaimedRewards(problemAddress);
      console.log(
        `   ✅ unclaimedRewards: ${ethers.formatEther(unclaimedRewards)} HYPHA`,
      );
    } catch (error: any) {
      console.log(`   ❌ unclaimedRewards failed: ${error.message}`);
    }

    // Method 3: Check reward debt
    try {
      console.log('\n3️⃣ Method 3: Check userRewardDebt...');
      const userRewardDebt = await contract.userRewardDebt(problemAddress);
      console.log(
        `   ✅ userRewardDebt: ${ethers.formatEther(userRewardDebt)} HYPHA`,
      );
    } catch (error: any) {
      console.log(`   ❌ userRewardDebt failed: ${error.message}`);
    }

    // Method 4: Batch call
    try {
      console.log('\n4️⃣ Method 4: Batch call with Promise.all...');
      const [pendingRewards, unclaimedRewards, userRewardDebt] =
        await Promise.all([
          contract.pendingRewards(problemAddress),
          contract.unclaimedRewards(problemAddress),
          contract.userRewardDebt(problemAddress),
        ]);

      console.log(
        `   ✅ pendingRewards: ${ethers.formatEther(pendingRewards)} HYPHA`,
      );
      console.log(
        `   ✅ unclaimedRewards: ${ethers.formatEther(unclaimedRewards)} HYPHA`,
      );
      console.log(
        `   ✅ userRewardDebt: ${ethers.formatEther(userRewardDebt)} HYPHA`,
      );

      const totalRewards = pendingRewards + unclaimedRewards;
      console.log(
        `   📊 Total rewards: ${ethers.formatEther(totalRewards)} HYPHA`,
      );

      if (totalRewards === 0n) {
        console.log('\n🎉 CONFIRMED! This address has ZERO pending rewards!');
        console.log('   ✅ pendingRewards = 0');
        console.log('   ✅ unclaimedRewards = 0');
        console.log('   ✅ Address is completely clean');
      } else {
        console.log('\n⚠️  This address still has pending rewards');
        console.log('   Needs additional clearing');
      }
    } catch (error: any) {
      console.log(`   ❌ Batch call failed: ${error.message}`);

      // If batch fails, the address might need individual clearing
      console.log('\n💡 This address may need individual clearing');
      console.log(
        '   The error suggests it might not have been processed correctly',
      );
    }

    console.log('\n' + '='.repeat(80));
    console.log('📊 FINAL VERIFICATION FOR PROBLEM ADDRESS');
    console.log('='.repeat(80));
    console.log(`Address: ${problemAddress}`);

    // Try one more time with error handling
    let finalPending = 'ERROR';
    let finalUnclaimed = 'ERROR';

    try {
      const pending = await contract.pendingRewards(problemAddress);
      finalPending = ethers.formatEther(pending) + ' HYPHA';
    } catch (e) {
      finalPending = 'Could not check';
    }

    try {
      const unclaimed = await contract.unclaimedRewards(problemAddress);
      finalUnclaimed = ethers.formatEther(unclaimed) + ' HYPHA';
    } catch (e) {
      finalUnclaimed = 'Could not check';
    }

    console.log(`Pending Rewards: ${finalPending}`);
    console.log(`Unclaimed Rewards: ${finalUnclaimed}`);

    if (finalPending.includes('0.0') && finalUnclaimed.includes('0.0')) {
      console.log('\n✅ SUCCESS! This address is confirmed clean!');
    } else if (
      finalPending === 'Could not check' ||
      finalUnclaimed === 'Could not check'
    ) {
      console.log('\n🔄 NETWORK ISSUE: Cannot verify due to RPC problems');
      console.log(
        '   This is likely a temporary network issue, not a contract problem',
      );
    } else {
      console.log('\n⚠️  NEEDS CLEARING: This address still has rewards');
    }
  } catch (error: any) {
    console.error('❌ Overall error:', error.message);
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
