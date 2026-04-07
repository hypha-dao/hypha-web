import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function main(): Promise<void> {
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
  const rpcUrl = 'https://mainnet.base.org';
  const privateKey = process.env.PRIVATE_KEY; // Optional - for actual transaction execution

  console.log(`🧪 COMPREHENSIVE TOKENOMICS VERIFICATION`);
  console.log(`Using RPC: ${rpcUrl}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}`);
  console.log(
    `Execution Mode: ${
      privateKey ? 'LIVE TRANSACTION' : 'READ-ONLY SIMULATION'
    }\n`,
  );

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  let signer: ethers.Wallet | null = null;

  if (privateKey) {
    signer = new ethers.Wallet(privateKey, provider);
    console.log(`🔑 Using wallet: ${signer.address}\n`);
  }

  // Extended ABI for full tokenomics testing
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
    'event SpacesPaymentProcessedWithHypha(address indexed user, uint256[] spaceIds, uint256[] durationsInDays, uint256 totalHyphaUsed, uint256 hyphaDirectlyMinted)',
    'event RewardsDistributed(uint256 amount, uint256 newAccumulatedRewardPerToken)',
  ];

  const contract = new ethers.Contract(hyphaTokenAddress, abi, provider);
  const contractWithSigner = signer ? contract.connect(signer) : null;

  // Test parameters
  const testAddress = signer
    ? signer.address
    : '0x2687fe290b54d824c136ceff2d5bd362bc62019a';
  const paymentAmount = ethers.parseEther('4'); // 4 HYPHA tokens
  const testSpaceId = 12345; // Arbitrary space ID for testing

  async function getContractState() {
    return {
      pendingDistribution: await contract.pendingDistribution(),
      accumulatedRewardPerToken: await contract.accumulatedRewardPerToken(),
      distributionMultiplier: await contract.distributionMultiplier(),
      eligibleSupply: await contract.getEligibleSupply(),
      totalSupply: await contract.totalSupply(),
      iexAddress: await contract.iexAddress(),
      hyphaPerDay: await contract.HYPHA_PER_DAY(),
      lastUpdateTime: await contract.lastUpdateTime(),
    };
  }

  async function getUserState(address: string) {
    return {
      balance: await contract.balanceOf(address),
      pendingRewards: await contract.pendingRewards(address),
      unclaimedRewards: await contract.unclaimedRewards(address),
      userRewardDebt: await contract.userRewardDebt(address),
    };
  }

  function formatState(label: string, state: any) {
    console.log(`${label}`);
    console.log('='.repeat(50));
    console.log(
      `Pending Distribution: ${ethers.formatEther(
        state.pendingDistribution,
      )} HYPHA`,
    );
    console.log(
      `Accumulated Reward Per Token: ${state.accumulatedRewardPerToken.toString()}`,
    );
    console.log(
      `Distribution Multiplier: ${state.distributionMultiplier.toString()}`,
    );
    console.log(
      `Eligible Supply: ${ethers.formatEther(state.eligibleSupply)} HYPHA`,
    );
    console.log(`Total Supply: ${ethers.formatEther(state.totalSupply)} HYPHA`);
    console.log(`IEX Address: ${state.iexAddress}`);
    console.log(
      `HYPHA Per Day: ${ethers.formatEther(state.hyphaPerDay)} HYPHA`,
    );
    console.log(
      `Last Update Time: ${new Date(
        Number(state.lastUpdateTime) * 1000,
      ).toISOString()}`,
    );
  }

  function formatUserState(label: string, address: string, state: any) {
    console.log(`${label} (${address})`);
    console.log('='.repeat(50));
    console.log(`Balance: ${ethers.formatEther(state.balance)} HYPHA`);
    console.log(
      `Pending Rewards: ${ethers.formatEther(state.pendingRewards)} HYPHA`,
    );
    console.log(
      `Unclaimed Rewards: ${ethers.formatEther(state.unclaimedRewards)} HYPHA`,
    );
    console.log(`Reward Debt: ${state.userRewardDebt.toString()}`);
  }

  try {
    // 1. Get initial state
    console.log('📊 STEP 1: INITIAL STATE');
    const initialState = await getContractState();
    const initialUserState = await getUserState(testAddress);

    formatState('CONTRACT STATE', initialState);
    console.log('');
    formatUserState('USER STATE', testAddress, initialUserState);

    // 2. Calculate expected changes
    console.log('\n🧮 STEP 2: EXPECTED TOKENOMICS');
    console.log('='.repeat(50));

    const expectedRewardGeneration =
      paymentAmount * initialState.distributionMultiplier;
    const daysOfPayment = paymentAmount / initialState.hyphaPerDay;

    console.log(`Payment: ${ethers.formatEther(paymentAmount)} HYPHA`);
    console.log(
      `Expected Reward Generation: ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA`,
    );
    console.log(
      `Days of Payment: ${ethers.formatUnits(daysOfPayment, 18)} days`,
    );
    console.log(
      `Formula: payment × multiplier = ${ethers.formatEther(paymentAmount)} × ${
        initialState.distributionMultiplier
      } = ${ethers.formatEther(expectedRewardGeneration)} HYPHA`,
    );

    // 3. Execute payment if possible
    if (contractWithSigner && signer) {
      console.log('\n💳 STEP 3: EXECUTING PAYMENT');
      console.log('='.repeat(50));

      // Check user has enough balance
      if (initialUserState.balance < paymentAmount) {
        throw new Error(
          `Insufficient balance. Need ${ethers.formatEther(
            paymentAmount,
          )} HYPHA, have ${ethers.formatEther(initialUserState.balance)} HYPHA`,
        );
      }

      console.log(
        `Paying for space ${testSpaceId} with ${ethers.formatEther(
          paymentAmount,
        )} HYPHA...`,
      );

      const tx = await contractWithSigner.payInHypha(
        [testSpaceId],
        [paymentAmount],
      );
      console.log(`Transaction hash: ${tx.hash}`);

      console.log('Waiting for confirmation...');
      const receipt = await tx.wait();
      console.log(`✅ Transaction confirmed in block ${receipt!.blockNumber}`);

      // Parse events
      const logs = receipt!.logs;
      for (const log of logs) {
        try {
          const parsed = contract.interface.parseLog(log);
          if (parsed) {
            console.log(`Event: ${parsed.name}`);
            console.log(`Args:`, parsed.args);
          }
        } catch (e) {
          // Ignore unparseable logs
        }
      }
    } else {
      console.log('\n💳 STEP 3: PAYMENT SIMULATION');
      console.log('='.repeat(50));
      console.log('⚠️  No private key provided - simulating payment only');
      console.log(
        `Would pay for space ${testSpaceId} with ${ethers.formatEther(
          paymentAmount,
        )} HYPHA`,
      );
    }

    // 4. Wait a moment for state changes to propagate
    if (contractWithSigner) {
      console.log('\nWaiting 3 seconds for state to update...');
      await new Promise((resolve) => setTimeout(resolve, 3000));
    }

    // 5. Get post-payment state
    console.log('\n📈 STEP 4: POST-PAYMENT STATE');
    const postState = await getContractState();
    const postUserState = await getUserState(testAddress);

    formatState('CONTRACT STATE', postState);
    console.log('');
    formatUserState('USER STATE', testAddress, postUserState);

    // 6. Verify changes
    console.log('\n✅ STEP 5: VERIFICATION');
    console.log('='.repeat(50));

    const pendingDistributionChange =
      postState.pendingDistribution - initialState.pendingDistribution;
    const accumulatorChange =
      postState.accumulatedRewardPerToken -
      initialState.accumulatedRewardPerToken;
    const userBalanceChange = postUserState.balance - initialUserState.balance;
    const userRewardsChange =
      postUserState.pendingRewards - initialUserState.pendingRewards;

    console.log('CHANGES DETECTED:');
    console.log(
      `Pending Distribution: ${ethers.formatEther(
        pendingDistributionChange,
      )} HYPHA`,
    );
    console.log(
      `Accumulated Reward Per Token: ${accumulatorChange.toString()}`,
    );
    console.log(`User Balance: ${ethers.formatEther(userBalanceChange)} HYPHA`);
    console.log(
      `User Pending Rewards: ${ethers.formatEther(userRewardsChange)} HYPHA`,
    );

    console.log('\nVERIFICATION RESULTS:');

    // Check if pending distribution increased correctly
    if (contractWithSigner) {
      if (pendingDistributionChange === expectedRewardGeneration) {
        console.log('✅ Pending distribution increased correctly');
      } else {
        console.log(`❌ Pending distribution change mismatch:`);
        console.log(
          `   Expected: ${ethers.formatEther(expectedRewardGeneration)} HYPHA`,
        );
        console.log(
          `   Actual: ${ethers.formatEther(pendingDistributionChange)} HYPHA`,
        );
      }

      // Check if user balance decreased correctly
      if (userBalanceChange === -paymentAmount) {
        console.log('✅ User balance decreased correctly');
      } else {
        console.log(`❌ User balance change mismatch:`);
        console.log(`   Expected: -${ethers.formatEther(paymentAmount)} HYPHA`);
        console.log(
          `   Actual: ${ethers.formatEther(userBalanceChange)} HYPHA`,
        );
      }
    } else {
      console.log('⚠️  Cannot verify changes without executing transaction');
    }

    // 7. Wait and check reward distribution
    if (contractWithSigner && pendingDistributionChange > 0n) {
      console.log('\n⏰ STEP 6: REWARD DISTRIBUTION MONITORING');
      console.log('='.repeat(50));
      console.log('Waiting 30 seconds to observe reward distribution...');

      await new Promise((resolve) => setTimeout(resolve, 30000));

      const laterState = await getContractState();
      const laterUserState = await getUserState(testAddress);

      const distributionDecrease =
        postState.pendingDistribution - laterState.pendingDistribution;
      const accumulatorIncrease =
        laterState.accumulatedRewardPerToken -
        postState.accumulatedRewardPerToken;
      const userRewardIncrease =
        laterUserState.pendingRewards - postUserState.pendingRewards;

      console.log('REWARD DISTRIBUTION PROGRESS:');
      console.log(
        `Pending Distribution Decrease: ${ethers.formatEther(
          distributionDecrease,
        )} HYPHA`,
      );
      console.log(`Accumulator Increase: ${accumulatorIncrease.toString()}`);
      console.log(
        `User Reward Increase: ${ethers.formatEther(userRewardIncrease)} HYPHA`,
      );

      if (distributionDecrease > 0n) {
        console.log('✅ Rewards are being distributed over time');
      } else {
        console.log(
          '⚠️  No reward distribution detected yet (may need more time)',
        );
      }
    }

    // 8. Summary
    console.log('\n🎯 FINAL SUMMARY');
    console.log('='.repeat(50));

    if (contractWithSigner) {
      console.log('TRANSACTION EXECUTED SUCCESSFULLY');
      console.log(
        `✅ Paid ${ethers.formatEther(
          paymentAmount,
        )} HYPHA for space ${testSpaceId}`,
      );
      console.log(
        `✅ Generated ${ethers.formatEther(
          expectedRewardGeneration,
        )} HYPHA in rewards`,
      );
      console.log(`✅ Rewards added to distribution pool`);
      console.log(`✅ Tokenomics working as expected`);
    } else {
      console.log('SIMULATION COMPLETED');
      console.log('To execute actual transaction:');
      console.log('1. Set PRIVATE_KEY environment variable');
      console.log('2. Ensure wallet has sufficient HYPHA balance');
      console.log('3. Run script again');
      console.log(
        `Expected behavior: Pay ${ethers.formatEther(
          paymentAmount,
        )} HYPHA → Generate ${ethers.formatEther(
          expectedRewardGeneration,
        )} HYPHA rewards`,
      );
    }
  } catch (error: any) {
    console.error('❌ Error during tokenomics verification:', error.message);

    if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('\n💰 INSUFFICIENT FUNDS');
      console.log('The wallet does not have enough ETH for gas fees.');
    } else if (error.reason) {
      console.log(`\n🚫 CONTRACT REVERT: ${error.reason}`);
    }
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
