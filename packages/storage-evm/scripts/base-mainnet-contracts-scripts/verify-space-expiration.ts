import dotenv from 'dotenv';
import { ethers, Log, EventLog, EventFilter } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// A reasonable block to start searching for events from, to avoid hitting RPC limits.
// This block is from early Sep 2023 on Base mainnet.
const START_BLOCK = 3000000;

interface EventWithArgs extends EventLog {
  args: any;
}

async function getEventsInChunks(
  contract: ethers.Contract,
  filter: any,
  fromBlock: number,
  toBlock: number,
  chunkSize: number = 100000,
): Promise<(EventLog | Log)[]> {
  let events: (EventLog | Log)[] = [];
  console.log(`\nFetching events from block ${fromBlock} to ${toBlock}...`);

  for (let start = fromBlock; start <= toBlock; start += chunkSize) {
    const end = Math.min(start + chunkSize - 1, toBlock);
    try {
      const chunkEvents = await contract.queryFilter(filter, start, end);
      events = events.concat(chunkEvents);
      process.stdout.write(`Scanned up to block ${end}...\r`);
    } catch (error) {
      console.warn(
        `\nWarning: Failed to fetch events for chunk ${start}-${end}. Retrying with smaller chunks...`,
      );
      // If the chunk fails, try breaking it down into smaller pieces
      try {
        const smallerChunkSize = Math.floor(chunkSize / 10);
        if (smallerChunkSize < 1) {
          throw new Error('Chunk size too small to proceed.');
        }
        for (
          let smallStart = start;
          smallStart <= end;
          smallStart += smallerChunkSize
        ) {
          const smallEnd = Math.min(smallStart + smallerChunkSize - 1, end);
          const smallChunkEvents = await contract.queryFilter(
            filter,
            smallStart,
            smallEnd,
          );
          events = events.concat(smallChunkEvents);
          process.stdout.write(
            `Scanned up to block ${smallEnd} (small chunk)...\r`,
          );
        }
      } catch (e) {
        console.error(
          `\nError fetching events in smaller chunk for range ${start}-${end}:`,
          e,
        );
        // Decide if you want to skip this chunk or stop the process
      }
    }
  }
  console.log('\nEvent fetching complete.');
  return events;
}

const hyphaTokenAbi = [
  'function payInHypha(uint256[] calldata spaceIds, uint256[] calldata hyphaAmounts) external',
  'function HYPHA_PER_DAY() external view returns (uint256)',
  'event SpacesPaymentProcessedWithHypha(address indexed user, uint256[] spaceIds, uint256[] durationsInDays, uint256 totalHypha, uint256 hyphaMinted)',
  'function balanceOf(address account) external view returns (uint256)',
];

const spacePaymentTrackerAbi = [
  'function getSpaceExpiryTime(uint256 spaceId) external view returns (uint256)',
  'event FreeTrialActivated(uint256 indexed spaceId)',
  'event SpacePaymentUpdated(uint256 indexed spaceId, uint256 expiryTime)',
];

const daoSpaceFactoryAbi = [
  'event SpaceCreated(uint256 indexed spaceId, uint256 unity, uint256 quorum, uint256 votingPowerSource, uint256 exitMethod, uint256 joinMethod, address indexed creator, address executor)',
];

// We will add ABIs and interfaces here

async function main(): Promise<void> {
  const rpcUrl =
    process.env.RPC_URL || 'https://base-mainnet.public.blastapi.io';
  if (!process.env.RPC_URL) {
    // throw new Error('RPC_URL environment variable not set.');
    console.log(`RPC_URL not set, using fallback: ${rpcUrl}`);
  }
  // Use environment RPC_URL if available, otherwise use reliable Base mainnet RPC
  console.log(`Using RPC URL: ${rpcUrl}`);

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

  const hyphaTokenAddress =
    process.env.HYPHA_TOKEN_ADDRESS ||
    '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
  const spacePaymentTrackerAddress =
    process.env.SPACE_PAYMENT_TRACKER_ADDRESS ||
    '0x4B61250c8F19BA96C473c65022453E95176b0139';
  const daoSpaceFactoryAddress =
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
    '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

  console.log(`🚀 SPACE EXPIRATION VERIFICATION`);
  console.log(`Using wallet address: ${wallet.address}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}`);
  console.log(`SpacePaymentTracker Contract: ${spacePaymentTrackerAddress}`);
  console.log(`DAOSpaceFactory Contract: ${daoSpaceFactoryAddress}\n`);

  const spaceId = 242;
  console.log(`Checking for Space ID: ${spaceId}\n`);

  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  );
  const spacePaymentTracker = new ethers.Contract(
    spacePaymentTrackerAddress,
    spacePaymentTrackerAbi,
    provider,
  );
  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    provider,
  );

  // --- Logic to verify expiration date ---

  // 1. Get current expiration date
  const currentExpiryTimestamp = await spacePaymentTracker.getSpaceExpiryTime(
    spaceId,
  );
  const currentExpiryDate = new Date(Number(currentExpiryTimestamp) * 1000);
  console.log(
    `Current on-chain expiration date: ${currentExpiryDate.toUTCString()}`,
  );
  console.log(`User sees in UI: ~3rd December`);

  // Check wallet balance
  const balance = await hyphaToken.balanceOf(wallet.address);
  console.log(
    `\nYour wallet HYPHA balance: ${ethers.formatEther(balance)} HYPHA`,
  );

  // --- Logic to make a payment ---
  console.log('\n\n--- MAKING A PAYMENT ---');
  const hyphaAmountToPay = ethers.parseEther('4');
  console.log(
    `Attempting to pay ${ethers.formatEther(
      hyphaAmountToPay,
    )} HYPHA for space ${spaceId}...`,
  );

  try {
    const tx = await hyphaToken.payInHypha([spaceId], [hyphaAmountToPay]);
    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log('✅ Payment successful!');
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);

    // --- Verify new expiration date ---
    console.log('\n--- VERIFYING NEW EXPIRATION ---');
    const newExpiryTimestamp = await spacePaymentTracker.getSpaceExpiryTime(
      spaceId,
    );
    const newExpiryDate = new Date(Number(newExpiryTimestamp) * 1000);

    console.log(`Old expiration date: ${currentExpiryDate.toUTCString()}`);
    console.log(`New expiration date: ${newExpiryDate.toUTCString()}`);

    const hyphaPerDay = await hyphaToken.HYPHA_PER_DAY();
    const expectedDurationIncrease =
      (Number(hyphaAmountToPay) / Number(hyphaPerDay)) * 24 * 60 * 60;

    const actualDurationIncrease =
      Number(newExpiryTimestamp) - Number(currentExpiryTimestamp);

    console.log(
      `Expected duration increase: ~${(
        expectedDurationIncrease /
        (24 * 60 * 60)
      ).toFixed(2)} days`,
    );
    console.log(
      `Actual duration increase: ${(
        actualDurationIncrease /
        (24 * 60 * 60)
      ).toFixed(2)} days`,
    );

    if (Math.abs(expectedDurationIncrease - actualDurationIncrease) < 60) {
      // allow 1 minute difference
      console.log('✅ Expiration date increased as expected.');
    } else {
      console.log('❌ Expiration date did NOT increase as expected.');
    }
  } catch (error) {
    console.error('Payment failed:', error);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
