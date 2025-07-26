import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// DAOProposalsImplementation ABI with necessary functions
const daoProposalsAbi = [
  {
    inputs: [],
    name: 'getAllExecutedProposals',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
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
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
        internalType: 'struct DAOProposalsStorage.Transaction[]',
        name: 'transactions',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getExecutedProposalsBySpace',
    outputs: [{ internalType: 'uint256[]', name: '', type: 'uint256[]' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_proposalId', type: 'uint256' },
      { internalType: 'address', name: '_voter', type: 'address' },
    ],
    name: 'hasVoted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'proposalId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'voter',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'bool',
        name: 'support',
        type: 'bool',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'votingPower',
        type: 'uint256',
      },
    ],
    name: 'VoteCast',
    type: 'event',
  },
];

// Helper function to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

// Interface for vote information
interface VoteInfo {
  voter: string;
  support: boolean;
  votingPower: bigint;
}

// Interface for voter summary
interface VoterSummary {
  address: string;
  proposalsVoted: number;
  yesVotes: number;
  noVotes: number;
  totalVotingPower: bigint;
  proposals: number[];
}

// Function to display voter summary
function displayVoterSummary(voterSummaries: Map<string, VoterSummary>) {
  if (voterSummaries.size === 0) {
    console.log('\n========== VOTER SUMMARY ==========');
    console.log('No voters found across all proposals.');
    return;
  }

  console.log('\n========== VOTER SUMMARY ==========');
  console.log(`Total unique voters: ${voterSummaries.size}`);
  console.log('\nDetailed voter breakdown:');

  // Convert to array and sort by number of proposals voted on (most active first)
  const sortedVoters = Array.from(voterSummaries.entries()).sort(
    ([, a], [, b]) => b.proposalsVoted - a.proposalsVoted,
  );

  sortedVoters.forEach(([address, summary], index) => {
    console.log(`\n${index + 1}. ${address}`);
    console.log(`   Proposals voted on: ${summary.proposalsVoted}`);
    console.log(`   YES votes: ${summary.yesVotes}`);
    console.log(`   NO votes: ${summary.noVotes}`);
    console.log(`   Total voting power used: ${summary.totalVotingPower}`);
    console.log(`   Proposal IDs: [${summary.proposals.join(', ')}]`);
  });

  // Additional statistics
  const totalVotes = Array.from(voterSummaries.values()).reduce(
    (sum, v) => sum + v.proposalsVoted,
    0,
  );
  const avgVotesPerVoter = totalVotes / voterSummaries.size;
  const mostActiveVoter = sortedVoters[0][1];

  console.log('\n---------- STATISTICS ----------');
  console.log(`Total votes cast: ${totalVotes}`);
  console.log(`Average votes per voter: ${avgVotesPerVoter.toFixed(1)}`);
  console.log(
    `Most active voter: ${sortedVoters[0][0]} (${mostActiveVoter.proposalsVoted} votes)`,
  );
}

// Function to estimate block number from timestamp (rough estimate for Base chain)
function estimateBlockFromTimestamp(
  timestamp: number,
  currentBlock?: number,
): number {
  // Base chain has roughly 2-second block times
  const BASE_BLOCK_TIME = 2; // seconds
  const currentTime = Math.floor(Date.now() / 1000);
  const timeDiff = currentTime - timestamp;
  const blocksDiff = Math.floor(timeDiff / BASE_BLOCK_TIME);

  // If we don't have current block, use a conservative estimate
  const estimatedCurrentBlock = currentBlock || 20000000; // Conservative estimate for Base
  return Math.max(0, estimatedCurrentBlock - blocksDiff);
}

// Function to fetch voters for a proposal using VoteCast events
async function getProposalVoters(
  contract: ethers.Contract,
  proposalId: number,
  proposalStartTime?: number,
  proposalEndTime?: number,
): Promise<VoteInfo[]> {
  try {
    // Create event filter for VoteCast events for this specific proposal
    const filter = contract.filters.VoteCast(proposalId);

    // Get the provider properly
    const provider = contract.runner?.provider as ethers.Provider;

    if (!provider) {
      console.log('No provider available, cannot query events');
      return [];
    }

    const currentBlock = await provider.getBlockNumber();

    let events: (ethers.EventLog | ethers.Log)[] = [];

    // Only use the working strategy: small chunk search
    console.log('Searching for votes using small chunks...');
    try {
      const chunkSize = 10000;
      for (let i = 0; i < 5; i++) {
        // Try 5 chunks
        const chunkStart = Math.max(0, currentBlock - (i + 1) * chunkSize);
        const chunkEnd = currentBlock - i * chunkSize;

        try {
          const chunkEvents = await contract.queryFilter(
            filter,
            chunkStart,
            chunkEnd,
          );
          events.push(...chunkEvents);

          if (chunkEvents.length > 0) {
            console.log(
              `✓ Found ${chunkEvents.length} vote events for proposal ${proposalId}`,
            );
            break; // Found events, stop searching
          }
        } catch (chunkError) {
          console.log(
            `✗ Chunk ${chunkStart}-${chunkEnd} failed, trying next chunk...`,
          );
        }
      }
    } catch (error) {
      console.log(`✗ Could not find votes for proposal ${proposalId}`);
    }

    // Process events to extract voter information
    const voters: VoteInfo[] = events
      .filter((event): event is ethers.EventLog => 'args' in event)
      .map((event) => ({
        voter: event.args.voter,
        support: event.args.support,
        votingPower: event.args.votingPower,
      }));

    return voters;
  } catch (error) {
    console.error(
      `Error fetching voters for proposal ${proposalId}:`,
      error.message,
    );
    return [];
  }
}

// Display proposal information
async function displayProposalInfo(
  proposalId: number,
  proposalData: any,
  contract: ethers.Contract,
  showVoters: boolean = false,
): Promise<VoteInfo[]> {
  console.log(`\n---------- PROPOSAL ${proposalId} ----------`);
  console.log(`Space ID: ${proposalData.spaceId}`);
  console.log(`Creator: ${proposalData.creator}`);
  console.log(`Start Time: ${formatDate(Number(proposalData.startTime))}`);
  console.log(`End Time: ${formatDate(Number(proposalData.endTime))}`);
  console.log(`Executed: ${proposalData.executed}`);
  console.log(`Expired: ${proposalData.expired}`);
  console.log(`Yes Votes: ${proposalData.yesVotes}`);
  console.log(`No Votes: ${proposalData.noVotes}`);
  console.log(
    `Total Voting Power at Snapshot: ${proposalData.totalVotingPowerAtSnapshot}`,
  );

  console.log(`\nTransactions (${proposalData.transactions.length}):`);
  proposalData.transactions.forEach((tx: any, index: number) => {
    console.log(`  ${index + 1}. Target: ${tx.target}`);
    console.log(`     Value: ${tx.value}`);
    console.log(`     Data: ${tx.data}`);
  });

  let voters: VoteInfo[] = [];

  // Fetch and display voter information if requested
  if (showVoters) {
    console.log('\n---------- VOTERS ----------');
    console.log('Fetching voter information...');

    voters = await getProposalVoters(
      contract,
      proposalId,
      Number(proposalData.startTime),
      Number(proposalData.endTime),
    );

    if (voters.length === 0) {
      console.log('No vote events found for this proposal.');
    } else {
      console.log(`Total voters: ${voters.length}`);

      const yesVoters = voters.filter((v) => v.support);
      const noVoters = voters.filter((v) => !v.support);

      console.log(`\nYES voters (${yesVoters.length}):`);
      yesVoters.forEach((vote, index) => {
        console.log(
          `  ${index + 1}. ${vote.voter} (${vote.votingPower} voting power)`,
        );
      });

      console.log(`\nNO voters (${noVoters.length}):`);
      noVoters.forEach((vote, index) => {
        console.log(
          `  ${index + 1}. ${vote.voter} (${vote.votingPower} voting power)`,
        );
      });
    }
  }

  return voters;
}

// Function to process the proposal data into a more usable format
function processProposalData(result: any) {
  return {
    spaceId: result[0],
    startTime: result[1],
    endTime: result[2],
    executed: result[3],
    expired: result[4],
    yesVotes: result[5],
    noVotes: result[6],
    totalVotingPowerAtSnapshot: result[7],
    creator: result[8],
    transactions: result[9],
  };
}

async function getAllExecutedProposals(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase();
  let spaceId: number | null = null;
  let showDetails = false;
  let showVoters = false;
  let specificProposalId: number | null = null;

  // Parse command line arguments
  if (command === 'space' && args.length > 1) {
    // Get executed proposals for a specific space
    spaceId = parseInt(args[1]);
    if (isNaN(spaceId)) {
      console.error('Invalid space ID. Please provide a valid number.');
      return;
    }
    // Automatically show voters when querying a specific space
    showVoters = true;
    showDetails = true;
  } else if (command === 'details') {
    // Show detailed information for each proposal
    showDetails = true;
  } else if (command === 'voters') {
    // Show voters for each proposal
    showVoters = true;
  } else if (command === 'proposal' && args.length > 1) {
    // Show voters for a specific proposal
    specificProposalId = parseInt(args[1]);
    if (isNaN(specificProposalId)) {
      console.error('Invalid proposal ID. Please provide a valid number.');
      return;
    }
    showVoters = true;
    showDetails = true;
  } else if (command && !isNaN(parseInt(command))) {
    // If first arg is just a number, treat it as a space ID
    spaceId = parseInt(command);
  }

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Initialize wallet
  let wallet;
  try {
    const privateKey = process.env.PRIVATE_KEY;
    if (privateKey) {
      const cleanPrivateKey = privateKey.startsWith('0x')
        ? privateKey.slice(2)
        : privateKey;
      wallet = new ethers.Wallet(cleanPrivateKey, provider);
      console.log(`Using wallet address: ${wallet.address}`);
    } else {
      wallet = ethers.Wallet.createRandom().connect(provider);
    }
  } catch (error) {
    console.error('Error setting up wallet:', error);
    return;
  }

  // Try multiple contract addresses if needed
  const contractAddresses = [
    process.env.DAO_PROPOSALS_ADDRESS,
    // Add fallback addresses here if needed
  ].filter(Boolean) as string[];

  // Remove duplicates
  const uniqueAddresses = [...new Set(contractAddresses)];

  // Try each contract address until one works
  let daoProposals: ethers.Contract | null = null;
  let workingAddress: string | null = null;

  for (const address of uniqueAddresses) {
    console.log(`Trying DAO Proposals contract at: ${address}`);
    const contract = new ethers.Contract(address, daoProposalsAbi, wallet);

    try {
      // Try a simple call to see if the contract is valid
      await contract.getAllExecutedProposals();
      daoProposals = contract;
      workingAddress = address;
      console.log(
        `Successfully connected to DAO Proposals contract at: ${address}`,
      );
      break;
    } catch (error) {
      console.log(
        `Could not validate contract at ${address}, trying next address...`,
      );
    }
  }

  if (!daoProposals || !workingAddress) {
    console.error(
      `Could not connect to any DAO Proposals contract. Please check the DAO_PROPOSALS_ADDRESS environment variable.`,
    );
    return;
  }

  try {
    // Handle specific proposal query
    if (specificProposalId !== null) {
      console.log(
        `Fetching details and voters for proposal ID: ${specificProposalId}`,
      );
      try {
        const proposalDataRaw = await daoProposals.getProposalCore(
          specificProposalId,
        );
        const proposalData = processProposalData(proposalDataRaw);
        await displayProposalInfo(
          specificProposalId,
          proposalData,
          daoProposals,
          showVoters,
        );
      } catch (error) {
        console.log(`Could not load proposal ${specificProposalId}`);
        console.error(error);
      }
      return;
    }

    let executedProposals: bigint[];

    if (spaceId !== null) {
      // Get executed proposals for a specific space
      console.log(`Fetching executed proposals for space ID: ${spaceId}`);
      executedProposals = await daoProposals.getExecutedProposalsBySpace(
        spaceId,
      );
      console.log(
        `\nFound ${executedProposals.length} executed proposals for space ${spaceId}:`,
      );
    } else {
      // Get all executed proposals across all spaces
      console.log('Fetching all executed proposals across all spaces...');
      executedProposals = await daoProposals.getAllExecutedProposals();
      console.log(
        `\nFound ${executedProposals.length} executed proposals total:`,
      );
    }

    if (executedProposals.length === 0) {
      console.log('No executed proposals found.');
      return;
    }

    // Display the proposal IDs
    console.log('\nExecuted Proposal IDs:');
    executedProposals.forEach((proposalId, index) => {
      console.log(`  ${index + 1}. Proposal ID: ${proposalId}`);
    });

    // If details are requested, fetch and display detailed information for each proposal
    if (showDetails || showVoters) {
      console.log('\n========== DETAILED PROPOSAL INFORMATION ==========');

      const voterSummaries = new Map<string, VoterSummary>();

      for (let i = 0; i < executedProposals.length; i++) {
        const proposalId = Number(executedProposals[i]);
        try {
          const proposalDataRaw = await daoProposals.getProposalCore(
            proposalId,
          );
          const proposalData = processProposalData(proposalDataRaw);
          const votersForThisProposal = await displayProposalInfo(
            proposalId,
            proposalData,
            daoProposals,
            showVoters,
          );

          // Collect voter data for summary
          if (showVoters) {
            votersForThisProposal.forEach((voter) => {
              const address = voter.voter;
              const existingSummary = voterSummaries.get(address);
              if (existingSummary) {
                existingSummary.proposalsVoted++;
                existingSummary.yesVotes += voter.support ? 1 : 0;
                existingSummary.noVotes += voter.support ? 0 : 1;
                existingSummary.totalVotingPower += voter.votingPower;
                existingSummary.proposals.push(proposalId);
              } else {
                voterSummaries.set(address, {
                  address,
                  proposalsVoted: 1,
                  yesVotes: voter.support ? 1 : 0,
                  noVotes: voter.support ? 0 : 1,
                  totalVotingPower: voter.votingPower,
                  proposals: [proposalId],
                });
              }
            });
          }
        } catch (error) {
          console.log(`\nCould not load details for proposal ${proposalId}`);
          console.error(error);
        }
      }

      // Display voter summary after all proposals are processed
      if (showVoters) {
        displayVoterSummary(voterSummaries);
      }
    } else {
      console.log(
        '\nTo see detailed information for each proposal, run with "details" argument:',
      );
      console.log('  ts-node get-all-executed-proposals.ts details');
      console.log(
        '\nTo see voters for each proposal, run with "voters" argument:',
      );
      console.log('  ts-node get-all-executed-proposals.ts voters');
    }
  } catch (error) {
    console.error('Error fetching executed proposals:', error);
    console.log('\nSomething went wrong. Check the error above for details.');
    console.log(
      '\nMake sure the DAO_PROPOSALS_ADDRESS environment variable is set correctly.',
    );
  }
}

// Usage information
function showUsage() {
  console.log('Usage:');
  console.log(
    '  ts-node get-all-executed-proposals.ts              # Get all executed proposals (IDs only)',
  );
  console.log(
    '  ts-node get-all-executed-proposals.ts details      # Get all executed proposals with details',
  );
  console.log(
    '  ts-node get-all-executed-proposals.ts voters       # Get all executed proposals with voters + summary',
  );
  console.log(
    '  ts-node get-all-executed-proposals.ts space 123    # Get executed proposals for space 123 with voters + summary',
  );
  console.log(
    '  ts-node get-all-executed-proposals.ts proposal 123 # Show details and voters for proposal 123',
  );
}

// Check if help is requested
const args = process.argv.slice(2);
if (args.includes('--help') || args.includes('-h')) {
  showUsage();
  process.exit(0);
}

// Run the script
getAllExecutedProposals().catch(console.error);
