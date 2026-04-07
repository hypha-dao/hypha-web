import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// DAOProposals ABI with necessary functions
const daoProposalsAbi = [
  {
    inputs: [],
    name: 'getLatestProposalId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'getProposalCore',
    outputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'uint256', name: 'startTime', type: 'uint256' },
      { internalType: 'uint256', name: 'endTime', type: 'uint256' },
      { internalType: 'bool', name: 'executed', type: 'bool' },
      { internalType: 'bool', name: 'expired', type: 'bool' },
      { internalType: 'uint256', name: 'yesVotes', type: 'uint256' },
      { internalType: 'uint256', name: 'noVotes', type: 'uint256' },
      {
        internalType: 'uint256',
        name: 'totalVotingPowerAtSnapshot',
        type: 'uint256',
      },
      { internalType: 'address', name: 'creator', type: 'address' },
      {
        internalType: 'tuple[]',
        name: 'transactions',
        type: 'tuple[]',
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'proposalCounter',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_proposalId', type: 'uint256' }],
    name: 'triggerExecutionCheck',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

// Helper function to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Function to determine the proposal status
function getProposalStatus(proposalData: any): string {
  const currentTime = Math.floor(Date.now() / 1000);

  if (proposalData.executed) return 'Executed';
  if (proposalData.expired) return 'Expired';
  if (currentTime < Number(proposalData.startTime)) return 'Pending';
  if (currentTime > Number(proposalData.endTime)) return 'Ended (Not Executed)';
  return 'Active';
}

// Display proposal information
function displayProposalInfo(proposalId: number, proposalData: any) {
  const status = getProposalStatus(proposalData);

  console.log('\n========== PROPOSAL DETAILS ==========');
  console.log(`Proposal ID: ${proposalId}`);
  console.log(`Space ID: ${proposalData.spaceId}`);
  console.log(`Status: ${status}`);
  console.log(`Creator: ${proposalData.creator}`);

  console.log('\n---------- Timing ----------');
  console.log(`Start time: ${formatDate(Number(proposalData.startTime))}`);
  console.log(`End time: ${formatDate(Number(proposalData.endTime))}`);

  if (proposalData.executed) {
    console.log('\nThis proposal has been executed.');
  } else if (proposalData.expired) {
    console.log('\nThis proposal has expired without being executed.');
  } else if (Date.now() / 1000 > Number(proposalData.endTime)) {
    console.log(
      '\nThis proposal has ended and is ready for an execution check.',
    );
  }
}

async function getLatestProposalIdWithFallback(
  contract: ethers.Contract,
): Promise<number> {
  try {
    return Number(await contract.getLatestProposalId());
  } catch (error) {
    console.log('Could not call getLatestProposalId, trying fallback...');
    try {
      return Number(await contract.proposalCounter());
    } catch (fallbackError) {
      console.log('Fallback also failed. Using binary search method...');
      return await findLatestProposalIdByBinarySearch(contract);
    }
  }
}

async function findLatestProposalIdByBinarySearch(
  contract: ethers.Contract,
): Promise<number> {
  let low = 1;
  let high = 1000;
  try {
    await contract.getProposalCore(1);
  } catch (error) {
    console.log('No proposals found starting from ID 1.');
    return 0;
  }

  while (true) {
    try {
      await contract.getProposalCore(high);
      low = high;
      high *= 2;
    } catch (error) {
      break;
    }
  }

  while (low < high - 1) {
    const mid = Math.floor((low + high) / 2);
    try {
      await contract.getProposalCore(mid);
      low = mid;
    } catch (error) {
      high = mid;
    }
  }
  return low;
}

async function findAndTriggerProposal(): Promise<void> {
  console.log('Connecting to network...');
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  const contractAddresses = [
    process.env.DAO_PROPOSALS_ADDRESS,
    '0x001bA7a00a259Fb12d7936455e292a60FC2bef14', // From addresses.txt
    '0xaC840F8A96EC6A6f9FbfdAae8daF8d9D679fd48B',
    '0x9C0563DAc7fa73875aEf56807782CCC7dE8df65b',
  ].filter(Boolean) as string[];

  const uniqueAddresses = [...new Set(contractAddresses)];

  let wallet;
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
      console.error('PRIVATE_KEY is not set in the .env file.');
      return;
    }
    const cleanPrivateKey = privateKey.startsWith('0x')
      ? privateKey.slice(2)
      : privateKey;
    wallet = new ethers.Wallet(cleanPrivateKey, provider);
    console.log(`Using wallet address: ${wallet.address}`);
  } catch (error) {
    console.error('Error setting up wallet:', error);
    return;
  }

  let daoProposals: ethers.Contract | null = null;
  for (const address of uniqueAddresses) {
    console.log(`Trying DAO Proposals contract at: ${address}`);
    const contract = new ethers.Contract(address, daoProposalsAbi, wallet);
    try {
      await contract.getProposalCore(1).catch(() => {});
      daoProposals = contract;
      console.log(`Successfully connected to DAO Proposals at: ${address}`);
      break;
    } catch (error) {
      console.log(
        `Could not validate contract at ${address}, trying next address...`,
      );
    }
  }

  if (!daoProposals) {
    console.error(
      'Could not connect to any DAO Proposals contract. Please check the addresses.',
    );
    return;
  }

  try {
    console.log('Fetching latest proposal ID...');
    const latestProposalId = await getLatestProposalIdWithFallback(
      daoProposals,
    );
    console.log(`Latest proposal ID: ${latestProposalId}`);

    if (latestProposalId === 0) {
      console.log('No proposals have been created yet.');
      return;
    }

    console.log(
      '\nSearching for an expired, non-executed proposal to trigger...',
    );
    // Search all proposals, from the latest down to ID 1.
    const startId = latestProposalId;
    const endId = 1;

    let proposalsProcessedCount = 0;

    for (let id = startId; id >= endId; id--) {
      try {
        const proposalData = await daoProposals.getProposalCore(id);
        const currentTime = Math.floor(Date.now() / 1000);

        // Check if the proposal is past its end time, but not yet expired or executed.
        // This targets proposals that are ready for their execution/rejection status to be finalized.
        const isReadyForCheck = currentTime > Number(proposalData.endTime);

        if (
          isReadyForCheck &&
          !proposalData.executed &&
          !proposalData.expired
        ) {
          console.log(
            `\nFound proposal ID ${id} that is ready for an execution check.`,
          );
          displayProposalInfo(id, proposalData);

          console.log(
            `\nAttempting to trigger execution check for proposal ${id}...`,
          );

          // Use the now-robust triggerExecutionCheck for all finalization
          const tx = await daoProposals.triggerExecutionCheck(id);
          console.log(`Transaction sent: ${tx.hash}`);

          const receipt = await tx.wait();
          console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
          console.log('Execution check triggered successfully.');

          proposalsProcessedCount++;
        }
      } catch (error) {
        // This might happen if a proposal ID in the range does not exist or if the transaction fails.
        console.error(`\nError processing proposal ${id}:`, error.message);
        console.log(
          `Skipping proposal ${id} due to an error during transaction.`,
        );
      }
    }

    console.log('\n--- Search Complete ---');
    if (proposalsProcessedCount > 0) {
      console.log(
        `Successfully triggered execution check for ${proposalsProcessedCount} proposal(s).`,
      );
    } else {
      console.log(`\nNo proposals ready for execution check were found.`);
    }
  } catch (error) {
    console.error('An error occurred:', error);
  }
}

// Run the script
findAndTriggerProposal().catch(console.error);
