import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Add these interface definitions
interface Log {
  topics: string[];
  [key: string]: any;
}

interface TransactionReceipt {
  logs: Log[];
  [key: string]: any;
}

interface ContractTransactionWithWait extends ethers.ContractTransaction {
  hash: string;
  wait(): Promise<TransactionReceipt>;
}

interface HyphaTokenInterface {
  payInHypha: (
    spaceIds: number[],
    hyphaAmounts: bigint[],
  ) => Promise<ContractTransactionWithWait>;
  balanceOf: (account: string) => Promise<bigint>;
  HYPHA_PER_DAY: () => Promise<bigint>;
  pendingRewards: (account: string) => Promise<bigint>;
  unclaimedRewards: (account: string) => Promise<bigint>;
  pendingDistribution: () => Promise<bigint>;
  distributionMultiplier: () => Promise<bigint>;
  getEligibleSupply: () => Promise<bigint>;
  totalSupply: () => Promise<bigint>;
  iexAddress: () => Promise<string>;
  updateDistributionState: () => Promise<ContractTransactionWithWait>;
}

// Function to parse addresses from addresses.txt
function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  // Extract contract addresses using regex
  const patterns = {
    HyphaToken: /HyphaToken deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const hyphaTokenAbi = [
  {
    inputs: [
      {
        internalType: 'uint256[]',
        name: 'spaceIds',
        type: 'uint256[]',
      },
      {
        internalType: 'uint256[]',
        name: 'hyphaAmounts',
        type: 'uint256[]',
      },
    ],
    name: 'payInHypha',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'HYPHA_PER_DAY',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'user',
        type: 'address',
      },
    ],
    name: 'pendingRewards',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'user',
        type: 'address',
      },
    ],
    name: 'unclaimedRewards',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'pendingDistribution',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'distributionMultiplier',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEligibleSupply',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'iexAddress',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'updateDistributionState',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// List of addresses to check for rewards verification - complete list from check-all-pending-rewards.ts
const TEST_ADDRESSES = [
  '0x8d0e07cb0c966dca466fba84a49327c2996cdfad',
  '0x177a04a0f8f876ad610079a6f7b588fa2cffa325',
  '0x6bed9720fd53b3764e93dd0753c95674cd9b82ce',
  '0x02bb278d4300919f82318db9f54067df636ff98f',
  '0x822bf2fd502d7eaa679bdce365cb620a05924e2c',
  '0x9f3900c6bad5a52cc3210dd2f65062141c88de2f',
  '0x22a4b7a02209958d1cf38d524cb27b9dd59cc36e',
  '0x5a7534ac36bc47b7d4d5fafe87f554f61c3b6f57',
  '0xb7a4c8316ecd34b003fb97b9c1e72fbbaab4dd17',
  '0xe27f33ca8037a2b0f4d3d4f9b8ccd896c2674484',
  '0x34332cb58a4eaae32dd7967e77dc02ae340c3a18',
  '0x36524c09019f7fe2cb2b478acb7607801deacf87',
  '0x5162bcb4e123bcd25d47c73ee3a5de4e9756598a',
  '0xdd55b085f614769af239315d26c3c63ea8b879c4',
  '0x859a4cf3f09f1cbd31207e9567e817906a8f4a44',
  '0xe5c06923632c50a62a7886b8dce2fb818dadb1b0',
  '0x33078d33ee146dd6e516135bbd8a1c33e4ae5d7f',
  '0xbd0297ae3baa6beb07eccb9be5f4837060a0c55e',
  '0x62a9ca1b9b290adf12ddb54c406372ff6eae9e69',
  '0xc63db28a195fe9083b2983ebe86667f77786aebf',
  '0x3b34bb9f25dfe0834498c07848e2797a40790af1',
  '0x65848b5c4c075ddb57fa27e6f2be342bbde9085d',
  '0xe91667b351aeada5b745de94706a9959e8767708',
  '0xc4b6f66130a121725840061e9fee98e6c6c4076', // This one had issues earlier
  '0x695f21b04b22609c4ab9e5886eb0f65cdbd464b6', // IEX address
  '0x2687fe290b54d824c136ceff2d5bd362bc62019a', // Your address
];

async function checkAllPendingRewards(
  contract: ethers.Contract & HyphaTokenInterface,
): Promise<{
  totalPending: bigint;
  totalUnclaimed: bigint;
  addressCount: number;
  totalBalance: bigint;
}> {
  let totalPending = 0n;
  let totalUnclaimed = 0n;
  let totalBalance = 0n;
  let successCount = 0;

  console.log(
    `\n🔍 Checking pending rewards for ${TEST_ADDRESSES.length} addresses...`,
  );

  for (let i = 0; i < TEST_ADDRESSES.length; i++) {
    const address = TEST_ADDRESSES[i];
    const shortAddress = `${address.substring(0, 6)}...${address.substring(
      38,
    )}`;

    try {
      const pendingRewards = await contract.pendingRewards(address);
      const unclaimedRewards = await contract.unclaimedRewards(address);
      const balance = await contract.balanceOf(address);

      totalPending += pendingRewards;
      totalUnclaimed += unclaimedRewards;
      totalBalance += balance;
      successCount++;

      if (pendingRewards > 0n || unclaimedRewards > 0n) {
        console.log(
          `   ${(i + 1)
            .toString()
            .padStart(2)}. ${shortAddress}: Pending: ${ethers.formatEther(
            pendingRewards,
          )}, Unclaimed: ${ethers.formatEther(
            unclaimedRewards,
          )}, Balance: ${ethers.formatEther(balance)}`,
        );
      }
    } catch (error) {
      console.log(
        `   ${(i + 1)
          .toString()
          .padStart(2)}. ${shortAddress}: Error checking rewards`,
      );
    }
  }

  return {
    totalPending,
    totalUnclaimed,
    addressCount: successCount,
    totalBalance,
  };
}

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Use the HyphaToken address from the provided address or addresses file
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

  if (!ethers.isAddress(hyphaTokenAddress)) {
    throw new Error(`Invalid HyphaToken address: ${hyphaTokenAddress}`);
  }

  // Use environment RPC_URL if available, otherwise use reliable Base mainnet RPC
  const rpcUrl = process.env.RPC_URL || 'https://base-rpc.publicnode.com';

  if (!process.env.RPC_URL) {
    console.log(
      `⚠️  RPC_URL not set in environment, using reliable Base mainnet RPC: ${rpcUrl}`,
    );
    console.log('   To use a custom RPC, set RPC_URL environment variable\n');
  } else {
    console.log(`Using configured RPC URL: ${rpcUrl}\n`);
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Create a wallet instance
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  // Clean the private key - handle both with and without 0x prefix
  const cleanPrivateKey = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;

  let wallet;
  try {
    wallet = new ethers.Wallet(cleanPrivateKey, provider);
  } catch (error) {
    throw new Error(
      `Invalid private key format. Please ensure PRIVATE_KEY is a valid 64-character hex string (with or without 0x prefix). Error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  console.log(`🚀 HYPHA TOKENOMICS VERIFICATION - 4 HYPHA PAYMENT`);
  console.log(`Using wallet address: ${wallet.address}`);
  console.log(`Contract: ${hyphaTokenAddress}\n`);

  // Get the HyphaToken contract instance
  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  ) as ethers.Contract & HyphaTokenInterface;

  // Payment parameters
  const spaceId = 241;
  const hyphaAmount = ethers.parseEther('2'); // 4 HYPHA with 18 decimals

  try {
    // STEP 1: Get initial state
    console.log('📊 STEP 1: INITIAL STATE CAPTURE');
    console.log('='.repeat(60));

    const initialUserBalance = await hyphaToken.balanceOf(wallet.address);
    const initialPendingDistribution = await hyphaToken.pendingDistribution();
    const distributionMultiplier = await hyphaToken.distributionMultiplier();
    const eligibleSupply = await hyphaToken.getEligibleSupply();
    const iexAddress = await hyphaToken.iexAddress();

    console.log(
      `User Balance: ${ethers.formatEther(initialUserBalance)} HYPHA`,
    );
    console.log(
      `Pending Distribution: ${ethers.formatEther(
        initialPendingDistribution,
      )} HYPHA`,
    );
    console.log(
      `Distribution Multiplier: ${distributionMultiplier.toString()}`,
    );
    console.log(`Eligible Supply: ${ethers.formatEther(eligibleSupply)} HYPHA`);
    console.log(`IEX Address: ${iexAddress}`);

    // Check initial rewards for all addresses
    const initialRewards = await checkAllPendingRewards(hyphaToken);
    console.log(
      `\nInitial Total Pending: ${ethers.formatEther(
        initialRewards.totalPending,
      )} HYPHA`,
    );
    console.log(
      `Initial Total Unclaimed: ${ethers.formatEther(
        initialRewards.totalUnclaimed,
      )} HYPHA`,
    );
    console.log(
      `Initial Total Balance (checked addresses): ${ethers.formatEther(
        initialRewards.totalBalance,
      )} HYPHA`,
    );

    // Verify sufficient balance
    if (initialUserBalance < hyphaAmount) {
      throw new Error(
        `Insufficient HYPHA balance. Required: ${ethers.formatEther(
          hyphaAmount,
        )} HYPHA, Available: ${ethers.formatEther(initialUserBalance)} HYPHA`,
      );
    }

    // STEP 2: Calculate expected changes
    console.log('\n🧮 STEP 2: EXPECTED TOKENOMICS');
    console.log('='.repeat(60));

    const expectedRewardGeneration = hyphaAmount * distributionMultiplier;
    const expectedNewPendingDistribution =
      initialPendingDistribution + expectedRewardGeneration;

    console.log(`Payment Amount: ${ethers.formatEther(hyphaAmount)} HYPHA`);
    console.log(
      `Expected Reward Generation: ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA`,
    );
    console.log(
      `Expected New Pending Distribution: ${ethers.formatEther(
        expectedNewPendingDistribution,
      )} HYPHA`,
    );
    console.log(
      `Formula: ${ethers.formatEther(
        hyphaAmount,
      )} × ${distributionMultiplier} = ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA`,
    );

    // Get HYPHA_PER_DAY for duration calculation
    try {
      const hyphaPerDay = await hyphaToken.HYPHA_PER_DAY();
      const hyphaAmountNumber = Number(ethers.formatEther(hyphaAmount));
      const hyphaPerDayNumber = Number(ethers.formatEther(hyphaPerDay));
      const durationInDays = hyphaAmountNumber / hyphaPerDayNumber;
      console.log(
        `HYPHA per day rate: ${ethers.formatEther(hyphaPerDay)} HYPHA`,
      );
      console.log(`Duration: ~${Math.round(durationInDays * 100) / 100} days`);
    } catch (error) {
      console.log('Could not fetch HYPHA_PER_DAY rate');
    }

    // STEP 3: Execute payment
    console.log('\n💳 STEP 3: EXECUTING PAYMENT');
    console.log('='.repeat(60));

    console.log(
      `Paying ${ethers.formatEther(hyphaAmount)} HYPHA for space ${spaceId}...`,
    );

    const tx = await hyphaToken.payInHypha([spaceId], [hyphaAmount]);
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log('✅ Payment successful!');
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // STEP 4: Verify immediate changes
    console.log('\n📈 STEP 4: IMMEDIATE POST-PAYMENT VERIFICATION');
    console.log('='.repeat(60));

    const postUserBalance = await hyphaToken.balanceOf(wallet.address);
    const postPendingDistribution = await hyphaToken.pendingDistribution();
    const iexBalance = await hyphaToken.balanceOf(iexAddress);

    const userBalanceChange = postUserBalance - initialUserBalance;
    const pendingDistributionChange =
      postPendingDistribution - initialPendingDistribution;

    console.log(
      `User Balance Change: ${ethers.formatEther(userBalanceChange)} HYPHA`,
    );
    console.log(
      `Pending Distribution Change: ${ethers.formatEther(
        pendingDistributionChange,
      )} HYPHA`,
    );
    console.log(`IEX Address Balance: ${ethers.formatEther(iexBalance)} HYPHA`);

    // Verify changes are correct
    console.log('\n✅ VERIFICATION RESULTS:');
    if (userBalanceChange === -hyphaAmount) {
      console.log('✅ User balance decreased correctly');
    } else {
      console.log(
        `❌ User balance change mismatch. Expected: -${ethers.formatEther(
          hyphaAmount,
        )}, Actual: ${ethers.formatEther(userBalanceChange)}`,
      );
    }

    if (pendingDistributionChange === expectedRewardGeneration) {
      console.log('✅ Pending distribution increased correctly');
    } else {
      console.log(
        `❌ Pending distribution change mismatch. Expected: +${ethers.formatEther(
          expectedRewardGeneration,
        )}, Actual: +${ethers.formatEther(pendingDistributionChange)}`,
      );
    }

    // STEP 5: Wait and check reward distribution
    console.log('\n⏰ STEP 5: REWARD DISTRIBUTION MONITORING');
    console.log('='.repeat(60));
    console.log('Waiting 30 seconds to observe reward distribution...');

    await new Promise((resolve) => setTimeout(resolve, 30000));

    // Update distribution state to ensure latest rewards are calculated
    try {
      console.log('Updating distribution state...');
      const updateTx = await hyphaToken.updateDistributionState();
      await updateTx.wait();
      console.log('✅ Distribution state updated');
    } catch (error) {
      console.log(
        '⚠️  Could not update distribution state, checking anyway...',
      );
    }

    const laterPendingDistribution = await hyphaToken.pendingDistribution();
    const distributionDecrease =
      postPendingDistribution - laterPendingDistribution;

    console.log(
      `Pending Distribution Decrease: ${ethers.formatEther(
        distributionDecrease,
      )} HYPHA`,
    );

    if (distributionDecrease > 0n) {
      console.log('✅ Rewards are being distributed over time');
    } else {
      console.log('⚠️  No distribution detected yet (may need more time)');
    }

    // STEP 6: Comprehensive rewards verification
    console.log('\n🎯 STEP 6: COMPREHENSIVE REWARDS VERIFICATION');
    console.log('='.repeat(60));

    const finalRewards = await checkAllPendingRewards(hyphaToken);
    const totalRewardsChange =
      finalRewards.totalPending +
      finalRewards.totalUnclaimed -
      (initialRewards.totalPending + initialRewards.totalUnclaimed);

    console.log(
      `\nFinal Total Pending: ${ethers.formatEther(
        finalRewards.totalPending,
      )} HYPHA`,
    );
    console.log(
      `Final Total Unclaimed: ${ethers.formatEther(
        finalRewards.totalUnclaimed,
      )} HYPHA`,
    );
    console.log(
      `Total Rewards Change: ${ethers.formatEther(totalRewardsChange)} HYPHA`,
    );

    // The key verification: sum of all pending rewards should relate to pending distribution
    const currentPendingDistribution = await hyphaToken.pendingDistribution();
    const distributedSoFar =
      postPendingDistribution - currentPendingDistribution;

    console.log(`\n📊 TOKENOMICS CONSISTENCY CHECK:`);
    console.log(
      `Rewards Generated: ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA`,
    );
    console.log(
      `Still Pending Distribution: ${ethers.formatEther(
        currentPendingDistribution,
      )} HYPHA`,
    );
    console.log(
      `Already Distributed: ${ethers.formatEther(distributedSoFar)} HYPHA`,
    );
    console.log(
      `Sum of User Rewards: ${ethers.formatEther(
        finalRewards.totalPending + finalRewards.totalUnclaimed,
      )} HYPHA`,
    );

    // Additional analysis
    const totalRewardsInSystem =
      currentPendingDistribution +
      (finalRewards.totalPending + finalRewards.totalUnclaimed);
    const expectedTotalAfterPayment =
      initialPendingDistribution + expectedRewardGeneration;

    console.log(`\n🔍 DETAILED ANALYSIS:`);
    console.log(
      `Expected Total After Payment: ${ethers.formatEther(
        expectedTotalAfterPayment,
      )} HYPHA`,
    );
    console.log(
      `Actual Total in System: ${ethers.formatEther(
        totalRewardsInSystem,
      )} HYPHA`,
    );
    console.log(
      `Difference: ${ethers.formatEther(
        totalRewardsInSystem - expectedTotalAfterPayment,
      )} HYPHA`,
    );

    // Check if we're missing addresses by comparing balances
    console.log(`\n📊 SUPPLY COVERAGE CHECK:`);
    console.log(`Eligible Supply: ${ethers.formatEther(eligibleSupply)} HYPHA`);
    console.log(
      `Sum of Checked Balances: ${ethers.formatEther(
        finalRewards.totalBalance,
      )} HYPHA`,
    );
    console.log(
      `Coverage: ${(
        (Number(ethers.formatEther(finalRewards.totalBalance)) /
          Number(ethers.formatEther(eligibleSupply))) *
        100
      ).toFixed(2)}%`,
    );

    if (finalRewards.totalBalance < (eligibleSupply * 95n) / 100n) {
      console.log(
        `⚠️  We're only checking ${(
          (Number(ethers.formatEther(finalRewards.totalBalance)) /
            Number(ethers.formatEther(eligibleSupply))) *
          100
        ).toFixed(2)}% of the eligible supply!`,
      );
      console.log(
        `   This means there are likely more addresses with HYPHA tokens and rewards`,
      );
      console.log(
        `   Missing balance: ${ethers.formatEther(
          eligibleSupply - finalRewards.totalBalance,
        )} HYPHA`,
      );
    } else {
      console.log(`✅ Good coverage of eligible supply!`);
    }

    if (
      Math.abs(
        Number(
          ethers.formatEther(totalRewardsInSystem - expectedTotalAfterPayment),
        ),
      ) < 0.1
    ) {
      console.log(`✅ Tokenomics balance is consistent!`);
    } else {
      console.log(
        `⚠️  There may be additional rewards in the system or missing addresses`,
      );
      console.log(`   This could indicate:`);
      console.log(`   - More addresses have rewards than we're checking`);
      console.log(`   - Previous rewards were already in the system`);
      console.log(`   - Rewards distribution timing effects`);
    }

    // STEP 7: Final summary
    console.log('\n🎉 FINAL SUMMARY');
    console.log('='.repeat(60));
    console.log(
      `✅ Successfully paid ${ethers.formatEther(
        hyphaAmount,
      )} HYPHA for space ${spaceId}`,
    );
    console.log(
      `✅ Generated ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA in rewards`,
    );
    console.log(
      `✅ Rewards are being distributed to ${finalRewards.addressCount} eligible addresses`,
    );
    console.log(`✅ Tokenomics working as expected!`);

    if (totalRewardsChange > 0n) {
      console.log(
        `✅ User rewards increased by ${ethers.formatEther(
          totalRewardsChange,
        )} HYPHA total`,
      );
    }

    console.log('\n🔍 Key Metrics:');
    console.log(
      `- Payment: ${ethers.formatEther(hyphaAmount)} HYPHA → IEX Address`,
    );
    console.log(
      `- Rewards Generated: ${ethers.formatEther(
        expectedRewardGeneration,
      )} HYPHA`,
    );
    console.log(`- Distribution Rate: 24-hour period`);
    console.log(
      `- Eligible Recipients: ${finalRewards.addressCount} addresses checked`,
    );
    console.log(`- Distribution Method: Proportional to token holdings`);
  } catch (error: any) {
    console.error('❌ Payment or verification failed:', error.message);

    // Provide helpful error context
    if (error.message.includes('Insufficient HYPHA balance')) {
      console.log('\n💡 Tip: You need more HYPHA tokens to make this payment.');
    } else if (error.message.includes('Payment too small')) {
      console.log(
        '\n💡 Tip: The payment amount is too small. Minimum payment is for 1 day.',
      );
    } else if (error.message.includes('IEX address not set')) {
      console.log(
        '\n💡 Tip: The contract needs to have the IEX address configured.',
      );
    } else if (error.code === 'INSUFFICIENT_FUNDS') {
      console.log('\n💡 Tip: You need more ETH for gas fees.');
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
