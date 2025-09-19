import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function main(): Promise<void> {
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
  const rpcUrl = 'https://mainnet.base.org';

  console.log(`🧪 TOKENOMICS VERIFICATION TEST`);
  console.log(`Using RPC: ${rpcUrl}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}\n`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Extended ABI for tokenomics testing
  const abi = [
    'function pendingRewards(address user) view returns (uint256)',
    'function unclaimedRewards(address user) view returns (uint256)',
    'function userRewardDebt(address user) view returns (uint256)',
    'function balanceOf(address account) view returns (uint256)',
    'function pendingDistribution() view returns (uint256)',
    'function accumulatedRewardPerToken() view returns (uint256)',
    'function distributionMultiplier() view returns (uint256)',
    'function getEligibleSupply() view returns (uint256)',
    'function totalSupply() view returns (uint256)',
    'function iexAddress() view returns (address)',
    'function HYPHA_PER_DAY() view returns (uint256)',
    'function lastUpdateTime() view returns (uint256)',
    'function updateDistributionState()',
    'function payInHypha(uint256[] calldata spaceIds, uint256[] calldata hyphaAmounts)',
    'function transfer(address to, uint256 amount) returns (bool)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
  ];

  const contract = new ethers.Contract(hyphaTokenAddress, abi, provider);

  // Test address - using your address from the original script
  const testAddress = '0x2687fe290b54d824c136ceff2d5bd362bc62019a';

  console.log(`📋 Testing tokenomics for address: ${testAddress}\n`);

  try {
    // 1. Get initial contract state
    console.log('📊 INITIAL CONTRACT STATE');
    console.log('='.repeat(50));

    // Try to get basic contract info first
    let initialPendingDistribution,
      initialAccumulatedRewardPerToken,
      distributionMultiplier;
    let eligibleSupply, totalSupply, iexAddress, hyphaPerDay, lastUpdateTime;

    try {
      initialPendingDistribution = await contract.pendingDistribution();
      console.log(
        `Pending Distribution: ${ethers.formatEther(
          initialPendingDistribution,
        )} HYPHA`,
      );
    } catch (e) {
      console.log(
        `Pending Distribution: Error - ${(e as any).message.substring(
          0,
          50,
        )}...`,
      );
      initialPendingDistribution = 0n;
    }

    try {
      initialAccumulatedRewardPerToken =
        await contract.accumulatedRewardPerToken();
      console.log(
        `Accumulated Reward Per Token: ${initialAccumulatedRewardPerToken.toString()}`,
      );
    } catch (e) {
      console.log(
        `Accumulated Reward Per Token: Error - ${(e as any).message.substring(
          0,
          50,
        )}...`,
      );
      initialAccumulatedRewardPerToken = 0n;
    }

    try {
      distributionMultiplier = await contract.distributionMultiplier();
      console.log(
        `Distribution Multiplier: ${distributionMultiplier.toString()}`,
      );
    } catch (e) {
      console.log(
        `Distribution Multiplier: Error - ${(e as any).message.substring(
          0,
          50,
        )}...`,
      );
      distributionMultiplier = 10n; // Default value
    }

    try {
      eligibleSupply = await contract.getEligibleSupply();
      console.log(
        `Eligible Supply: ${ethers.formatEther(eligibleSupply)} HYPHA`,
      );
    } catch (e) {
      console.log(
        `Eligible Supply: Error - ${(e as any).message.substring(0, 50)}...`,
      );
      eligibleSupply = 0n;
    }

    try {
      totalSupply = await contract.totalSupply();
      console.log(`Total Supply: ${ethers.formatEther(totalSupply)} HYPHA`);
    } catch (e) {
      console.log(
        `Total Supply: Error - ${(e as any).message.substring(0, 50)}...`,
      );
      totalSupply = 0n;
    }

    try {
      iexAddress = await contract.iexAddress();
      console.log(`IEX Address: ${iexAddress}`);
    } catch (e) {
      console.log(
        `IEX Address: Error - ${(e as any).message.substring(0, 50)}...`,
      );
      iexAddress = '0x0000000000000000000000000000000000000000';
    }

    try {
      hyphaPerDay = await contract.HYPHA_PER_DAY();
      console.log(`HYPHA Per Day: ${ethers.formatEther(hyphaPerDay)} HYPHA`);
    } catch (e) {
      console.log(
        `HYPHA Per Day: Error - ${(e as any).message.substring(0, 50)}...`,
      );
      hyphaPerDay = ethers.parseEther('1.468'); // Default value
    }

    try {
      lastUpdateTime = await contract.lastUpdateTime();
      console.log(
        `Last Update Time: ${new Date(
          Number(lastUpdateTime) * 1000,
        ).toISOString()}`,
      );
    } catch (e) {
      console.log(
        `Last Update Time: Error - ${(e as any).message.substring(0, 50)}...`,
      );
      lastUpdateTime = BigInt(Math.floor(Date.now() / 1000));
    }

    // 2. Get initial user state
    console.log('\n👤 INITIAL USER STATE');
    console.log('='.repeat(50));

    let initialBalance,
      initialPendingRewards,
      initialUnclaimedRewards,
      initialUserRewardDebt;

    try {
      initialBalance = await contract.balanceOf(testAddress);
      console.log(`User Balance: ${ethers.formatEther(initialBalance)} HYPHA`);
    } catch (e) {
      console.log(
        `User Balance: Error - ${(e as any).message.substring(0, 50)}...`,
      );
      initialBalance = 0n;
    }

    try {
      initialPendingRewards = await contract.pendingRewards(testAddress);
      console.log(
        `User Pending Rewards: ${ethers.formatEther(
          initialPendingRewards,
        )} HYPHA`,
      );
    } catch (e) {
      console.log(
        `User Pending Rewards: Error - ${(e as any).message.substring(
          0,
          50,
        )}...`,
      );
      initialPendingRewards = 0n;
    }

    try {
      initialUnclaimedRewards = await contract.unclaimedRewards(testAddress);
      console.log(
        `User Unclaimed Rewards: ${ethers.formatEther(
          initialUnclaimedRewards,
        )} HYPHA`,
      );
    } catch (e) {
      console.log(
        `User Unclaimed Rewards: Error - ${(e as any).message.substring(
          0,
          50,
        )}...`,
      );
      initialUnclaimedRewards = 0n;
    }

    try {
      initialUserRewardDebt = await contract.userRewardDebt(testAddress);
      console.log(`User Reward Debt: ${initialUserRewardDebt.toString()}`);
    } catch (e) {
      console.log(
        `User Reward Debt: Error - ${(e as any).message.substring(0, 50)}...`,
      );
      initialUserRewardDebt = 0n;
    }

    // 3. Calculate expected tokenomics
    console.log('\n🧮 TOKENOMICS CALCULATIONS');
    console.log('='.repeat(50));

    const paymentAmount = ethers.parseEther('4'); // 4 HYPHA tokens
    const expectedRewardGeneration = paymentAmount * distributionMultiplier;
    const daysOfPayment = paymentAmount / hyphaPerDay;

    console.log(`Payment Amount: ${ethers.formatEther(paymentAmount)} HYPHA`);
    console.log(
      `Expected Reward Generation: ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA`,
    );
    console.log(
      `Days of Payment: ${ethers.formatUnits(daysOfPayment, 18)} days`,
    );
    console.log(
      `Formula: ${ethers.formatEther(
        paymentAmount,
      )} HYPHA × ${distributionMultiplier} = ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA rewards`,
    );

    // 4. Simulate the payment (we can't actually execute it without private key)
    console.log('\n⚠️  SIMULATION MODE');
    console.log('='.repeat(50));
    console.log(
      'Cannot execute actual payInHypha transaction without private key.',
    );
    console.log('This script shows what SHOULD happen when paying 4 HYPHA:');
    console.log(
      `1. 4 HYPHA would be transferred from user to IEX address (${iexAddress})`,
    );
    console.log(
      `2. ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA would be added to pendingDistribution`,
    );
    console.log(
      `3. These rewards would be distributed over time to eligible token holders`,
    );
    console.log(
      `4. The distribution would increase accumulatedRewardPerToken over time`,
    );

    // 5. Show what the state would look like after payment
    console.log('\n📈 EXPECTED POST-PAYMENT STATE');
    console.log('='.repeat(50));

    const expectedNewPendingDistribution =
      initialPendingDistribution + expectedRewardGeneration;
    console.log(
      `New Pending Distribution: ${ethers.formatEther(
        expectedNewPendingDistribution,
      )} HYPHA`,
    );
    console.log(
      `Increase: +${ethers.formatEther(expectedRewardGeneration)} HYPHA`,
    );

    // 6. Calculate reward distribution rate
    console.log('\n⏰ REWARD DISTRIBUTION TIMELINE');
    console.log('='.repeat(50));

    const distributionPeriod = 24 * 60 * 60; // 1 day in seconds
    const emissionRate = expectedRewardGeneration / BigInt(distributionPeriod);
    const rewardsPerHour = emissionRate * BigInt(3600);

    console.log(`Distribution Period: 1 day (${distributionPeriod} seconds)`);
    console.log(
      `Emission Rate: ${ethers.formatEther(emissionRate)} HYPHA per second`,
    );
    console.log(
      `Rewards Per Hour: ${ethers.formatEther(rewardsPerHour)} HYPHA`,
    );

    // 7. Calculate user's share of rewards (if they have tokens)
    if (initialBalance > 0n && eligibleSupply > 0n) {
      console.log('\n💰 USER REWARD PROJECTION');
      console.log('='.repeat(50));

      const userSharePercentage = (initialBalance * 10000n) / eligibleSupply; // basis points
      const userExpectedRewards =
        (expectedRewardGeneration * initialBalance) / eligibleSupply;

      console.log(
        `User's Share of Supply: ${ethers.formatUnits(
          userSharePercentage,
          2,
        )}%`,
      );
      console.log(
        `User's Expected Rewards: ${ethers.formatEther(
          userExpectedRewards,
        )} HYPHA`,
      );
      console.log(
        `User's Rewards Per Hour: ${ethers.formatEther(
          (userExpectedRewards * BigInt(3600)) / BigInt(distributionPeriod),
        )} HYPHA`,
      );
    } else {
      console.log('\n💰 USER REWARD PROJECTION');
      console.log('='.repeat(50));
      console.log(
        'User has no HYPHA balance, so they would not receive rewards from this payment.',
      );
    }

    // 8. Verification checklist
    console.log('\n✅ VERIFICATION CHECKLIST');
    console.log('='.repeat(50));
    console.log('To verify tokenomics are working correctly:');
    console.log('1. Execute payInHypha with 4 HYPHA tokens');
    console.log('2. Check that pendingDistribution increased by 40 HYPHA');
    console.log(
      '3. Wait some time and check that accumulatedRewardPerToken increases',
    );
    console.log(
      '4. Check that users with HYPHA balances have increasing pendingRewards',
    );
    console.log(
      '5. Verify that rewards are distributed proportionally to token holdings',
    );

    console.log('\n🎯 EXPECTED RESULTS SUMMARY');
    console.log('='.repeat(50));
    console.log(`Payment: 4 HYPHA → IEX Address`);
    console.log(`Reward Generation: 40 HYPHA → Pending Distribution`);
    console.log(`Distribution Time: 24 hours`);
    console.log(`Eligible Recipients: All HYPHA holders except IEX address`);
    console.log(`Distribution Method: Proportional to token balance`);
  } catch (error: any) {
    console.error('❌ Error during tokenomics verification:', error.message);

    // If it's a network error, show some debugging info
    if (error.code === 'NETWORK_ERROR' || error.code === 'SERVER_ERROR') {
      console.log('\n🔧 NETWORK DEBUGGING');
      console.log('='.repeat(50));
      console.log('Network error occurred. This could be due to:');
      console.log('- RPC endpoint issues');
      console.log('- Contract address incorrect');
      console.log('- Network connectivity problems');
      console.log('\nTry:');
      console.log('1. Checking the RPC endpoint');
      console.log('2. Verifying the contract address');
      console.log('3. Testing with a different RPC provider');
    }
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
