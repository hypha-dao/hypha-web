import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const spacePaymentTrackerAbi = [
  {
    inputs: [{ internalType: 'uint256', name: 'spaceId', type: 'uint256' }],
    name: 'getSpaceExpiryTime',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'spaceId', type: 'uint256' }],
    name: 'hasUsedFreeTrial',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: 'spaceId', type: 'uint256' }],
    name: 'isSpaceActive',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'FREE_TRIAL_DAYS',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

function formatTimestamp(timestamp: bigint): string {
  if (timestamp === 0n) {
    return 'Never set';
  }

  // Handle corrupted/invalid timestamps
  const timestampNumber = Number(timestamp);

  // Check if timestamp is reasonable (between 1970 and year 3000)
  // Normal timestamps should be between ~0 and ~32503680000 (year 3000)
  if (timestampNumber < 0 || timestampNumber > 32503680000) {
    return `Invalid timestamp: ${timestamp.toString()}`;
  }

  try {
    const date = new Date(timestampNumber * 1000);
    if (isNaN(date.getTime())) {
      return `Invalid timestamp: ${timestamp.toString()}`;
    }
    return date.toISOString();
  } catch (error) {
    return `Invalid timestamp: ${timestamp.toString()}`;
  }
}

function getTimeRemaining(expiryTimestamp: bigint): string {
  if (expiryTimestamp === 0n) {
    return 'No expiry set';
  }

  const expiry = Number(expiryTimestamp);

  // Handle corrupted/invalid timestamps
  if (expiry < 0 || expiry > 32503680000) {
    return 'Invalid timestamp - cannot calculate';
  }

  const now = Math.floor(Date.now() / 1000);

  if (expiry <= now) {
    return 'Expired';
  }

  const secondsRemaining = expiry - now;
  const days = Math.floor(secondsRemaining / (24 * 60 * 60));
  const hours = Math.floor((secondsRemaining % (24 * 60 * 60)) / (60 * 60));
  const minutes = Math.floor((secondsRemaining % (60 * 60)) / 60);

  return `${days}d ${hours}h ${minutes}m remaining`;
}

async function checkSpacePaymentInfo(
  spaceId: number,
  contract: ethers.Contract,
): Promise<any> {
  try {
    const [expiryTime, hasUsedTrial, isActive] = await Promise.all([
      contract.getSpaceExpiryTime(spaceId) as Promise<bigint>,
      contract.hasUsedFreeTrial(spaceId) as Promise<boolean>,
      contract.isSpaceActive(spaceId) as Promise<boolean>,
    ]);

    return {
      spaceId,
      expiryTime: Number(expiryTime),
      expiryDate: formatTimestamp(expiryTime),
      timeRemaining: getTimeRemaining(expiryTime),
      hasUsedFreeTrial: hasUsedTrial,
      isActive,
    };
  } catch (error) {
    return {
      spaceId,
      error: `Failed to fetch data: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }
}

async function main(): Promise<void> {
  // SpacePaymentTracker contract address
  const trackerAddress = '0x4B61250c8F19BA96C473c65022453E95176b0139';

  if (!ethers.isAddress(trackerAddress)) {
    throw new Error(`Invalid tracker address: ${trackerAddress}`);
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

  const provider = new ethers.JsonRpcProvider(rpcUrl);

  const trackerContract = new ethers.Contract(
    trackerAddress,
    spacePaymentTrackerAbi,
    provider,
  );

  // Space IDs to check
  const spaceIds = [238, 239, 240, 241, 242, 243];

  console.log('Checking Space Payment Information...\n');
  console.log(`Tracker Contract: ${trackerAddress}\n`);

  // Get FREE_TRIAL_DAYS constant
  try {
    const freeTrialDays = await trackerContract.FREE_TRIAL_DAYS();
    console.log(`Free Trial Duration: ${freeTrialDays} days\n`);
  } catch (error) {
    console.log('Could not fetch FREE_TRIAL_DAYS constant\n');
  }

  // Check each space (sequentially to avoid RPC batch limits)
  const results = [];
  for (const spaceId of spaceIds) {
    console.log(`Checking space ${spaceId}...`);
    const result = await checkSpacePaymentInfo(spaceId, trackerContract);
    results.push(result);
  }
  console.log();

  // Display results
  for (const result of results) {
    console.log('='.repeat(60));
    console.log(`🏢 SPACE ID: ${result.spaceId}`);
    console.log('='.repeat(60));

    if (result.error) {
      console.log(`❌ Error: ${result.error}`);
      console.log(`   This space may not exist or have access restrictions`);
    } else {
      // Status indicators
      const statusIcon = result.isActive ? '✅' : '❌';
      const trialIcon = result.hasUsedFreeTrial ? '🎯' : '⭕';

      console.log(
        `${statusIcon} Status: ${result.isActive ? 'ACTIVE' : 'INACTIVE'}`,
      );
      console.log(
        `${trialIcon} Free Trial: ${
          result.hasUsedFreeTrial ? 'USED' : 'NOT USED'
        }`,
      );

      if (result.expiryTime === 0) {
        console.log(`📅 Expiry: Never set (no payments or trial activated)`);
        console.log(`⏰ Time Status: No active subscription`);
      } else if (result.expiryDate.startsWith('Invalid timestamp')) {
        console.log(`📅 Expiry: ${result.expiryDate}`);
        console.log(`🕐 Raw Expiry Timestamp: ${result.expiryTime}`);
        console.log(`⏰ Time Status: ${result.timeRemaining}`);
        console.log(`⚠️  Warning: This space has corrupted timestamp data`);
      } else {
        console.log(`📅 Expiry: ${result.expiryDate}`);
        console.log(`🕐 Expiry Timestamp: ${result.expiryTime}`);
        console.log(`⏰ Time Status: ${result.timeRemaining}`);
      }

      // Additional context
      if (!result.hasUsedFreeTrial && result.expiryTime === 0) {
        console.log(
          `💡 Note: This space can still activate its 30-day free trial`,
        );
      } else if (result.hasUsedFreeTrial && !result.isActive) {
        console.log(
          `💡 Note: Free trial was used but subscription has expired`,
        );
      } else if (result.hasUsedFreeTrial && result.isActive) {
        console.log(
          `💡 Note: Free trial was used and subscription is currently active`,
        );
      }
    }
    console.log('='.repeat(60));
    console.log();
  }

  // Summary
  const successfulResults = results.filter((r) => !r.error);
  const errorResults = results.filter((r) => r.error);
  const activeSpaces = successfulResults.filter((r) => r.isActive);
  const inactiveSpaces = successfulResults.filter((r) => !r.isActive);
  const spacesWithTrialUsed = successfulResults.filter(
    (r) => r.hasUsedFreeTrial,
  );
  const spacesWithTrialAvailable = successfulResults.filter(
    (r) => !r.hasUsedFreeTrial,
  );

  console.log('📊 DETAILED SUMMARY:');
  console.log('='.repeat(60));
  console.log(`🔍 Total spaces checked: ${results.length}`);
  console.log(`✅ Successfully queried: ${successfulResults.length}`);
  console.log(`❌ Errors/Not found: ${errorResults.length}`);
  console.log();
  console.log('📈 STATUS BREAKDOWN:');
  console.log(
    `   🟢 Active spaces: ${activeSpaces.length} (${activeSpaces
      .map((r) => r.spaceId)
      .join(', ')})`,
  );
  console.log(
    `   🔴 Inactive spaces: ${inactiveSpaces.length} (${inactiveSpaces
      .map((r) => r.spaceId)
      .join(', ')})`,
  );
  console.log();
  console.log('🎯 FREE TRIAL BREAKDOWN:');
  console.log(
    `   ✨ Trial used: ${spacesWithTrialUsed.length} (${
      spacesWithTrialUsed.map((r) => r.spaceId).join(', ') || 'none'
    })`,
  );
  console.log(
    `   💎 Trial available: ${spacesWithTrialAvailable.length} (${
      spacesWithTrialAvailable.map((r) => r.spaceId).join(', ') || 'none'
    })`,
  );

  if (errorResults.length > 0) {
    console.log();
    console.log('⚠️  ERRORS:');
    errorResults.forEach((r) => {
      console.log(
        `   Space ${r.spaceId}: Likely doesn't exist or access restricted`,
      );
    });
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
