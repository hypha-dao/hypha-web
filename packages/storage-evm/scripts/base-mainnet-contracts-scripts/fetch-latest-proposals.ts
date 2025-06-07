import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface Transaction {
  target: string;
  value: bigint;
  data: string;
}

interface ProposalData {
  spaceId: bigint;
  startTime: bigint;
  endTime: bigint;
  executed: boolean;
  expired: boolean;
  yesVotes: bigint;
  noVotes: bigint;
  totalVotingPowerAtSnapshot: bigint;
  creator: string;
  transactions: Transaction[];
}

interface FetchRange {
  startId: number;
  endId: number;
  totalToFetch: number;
}

// DAO Proposals ABI with necessary functions
const daoProposalsAbi = [
  {
    inputs: [],
    name: 'proposalCounter',
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
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
        internalType: 'struct IDAOProposals.Transaction[]',
        name: 'transactions',
        type: 'tuple[]',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

function parseCommandLineArgs(): {
  startId?: number;
  endId?: number;
  count?: number;
} {
  const args = process.argv.slice(2);
  const result: { startId?: number; endId?: number; count?: number } = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--start':
      case '-s':
        if (args[i + 1]) {
          result.startId = parseInt(args[i + 1]);
          i++; // skip next argument
        }
        break;
      case '--end':
      case '-e':
        if (args[i + 1]) {
          result.endId = parseInt(args[i + 1]);
          i++; // skip next argument
        }
        break;
      case '--count':
      case '-c':
        if (args[i + 1]) {
          result.count = parseInt(args[i + 1]);
          i++; // skip next argument
        }
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
        break;
    }
  }

  return result;
}

function printUsage(): void {
  console.log('Usage: ts-node fetch-latest-proposals.ts [options]');
  console.log('');
  console.log('Options:');
  console.log('  -s, --start <id>   Start proposal ID');
  console.log('  -e, --end <id>     End proposal ID');
  console.log(
    '  -c, --count <n>    Number of latest proposals to fetch (default: 5)',
  );
  console.log('  -h, --help         Show this help message');
  console.log('');
  console.log('Examples:');
  console.log(
    '  ts-node fetch-latest-proposals.ts                    # Fetch latest 5 proposals',
  );
  console.log(
    '  ts-node fetch-latest-proposals.ts -c 10              # Fetch latest 10 proposals',
  );
  console.log(
    '  ts-node fetch-latest-proposals.ts -s 5 -e 10         # Fetch proposals 5 to 10',
  );
  console.log(
    '  ts-node fetch-latest-proposals.ts -s 15              # Fetch from proposal 15 to latest',
  );
}

function calculateFetchRange(
  totalProposals: number,
  args: { startId?: number; endId?: number; count?: number },
): FetchRange {
  let startId: number;
  let endId: number;

  if (args.startId !== undefined && args.endId !== undefined) {
    // Both start and end specified
    startId = Math.max(1, args.startId);
    endId = Math.min(totalProposals, args.endId);
    if (startId > endId) {
      throw new Error('Start ID cannot be greater than end ID');
    }
  } else if (args.startId !== undefined) {
    // Only start specified - fetch from start to latest
    startId = Math.max(1, args.startId);
    endId = totalProposals;
  } else if (args.endId !== undefined) {
    // Only end specified - fetch latest up to end
    endId = Math.min(totalProposals, args.endId);
    const count = args.count || 5;
    startId = Math.max(1, endId - count + 1);
  } else {
    // No range specified - use count (default 5 latest)
    const count = args.count || 5;
    const proposalsToFetch = Math.min(count, totalProposals);
    startId = totalProposals - proposalsToFetch + 1;
    endId = totalProposals;
  }

  return {
    startId,
    endId,
    totalToFetch: endId - startId + 1,
  };
}

function formatProposalData(proposalId: number, data: ProposalData): void {
  console.log(`\n=== PROPOSAL #${proposalId} ===`);
  console.log(`Space ID: ${data.spaceId}`);
  console.log(`Creator: ${data.creator}`);
  console.log(
    `Start Time: ${new Date(Number(data.startTime) * 1000).toLocaleString()}`,
  );
  console.log(
    `End Time: ${new Date(Number(data.endTime) * 1000).toLocaleString()}`,
  );
  console.log(
    `Status: ${
      data.executed ? '✅ EXECUTED' : data.expired ? '❌ EXPIRED' : '⏳ ACTIVE'
    }`,
  );
  console.log(`Yes Votes: ${data.yesVotes}`);
  console.log(`No Votes: ${data.noVotes}`);
  console.log(`Total Voting Power: ${data.totalVotingPowerAtSnapshot}`);

  if (data.yesVotes + data.noVotes > 0n) {
    const yesPercentage =
      (Number(data.yesVotes) * 100) / Number(data.yesVotes + data.noVotes);
    console.log(`Yes Vote Percentage: ${yesPercentage.toFixed(2)}%`);
  }

  console.log(`Transactions (${data.transactions.length}):`);
  data.transactions.forEach((tx, index) => {
    console.log(`  ${index + 1}. Target: ${tx.target}`);
    console.log(`     Value: ${ethers.formatEther(tx.value)} ETH`);
    console.log(
      `     Data: ${tx.data.slice(0, 42)}${tx.data.length > 42 ? '...' : ''}`,
    );
  });
}

async function fetchLatestProposals(): Promise<void> {
  const args = parseCommandLineArgs();

  console.log('🔍 Fetching proposals from DAO...\n');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Use the correct DAO Proposals address from addresses.txt
  const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    provider,
  );

  console.log(`Connected to DAO Proposals at: ${daoProposalsAddress}`);

  try {
    // Get the current proposal counter
    const proposalCounter = await daoProposals.proposalCounter();
    console.log(`Total proposals created: ${proposalCounter}\n`);

    if (proposalCounter === 0n) {
      console.log('No proposals found.');
      return;
    }

    // Calculate the range to fetch
    const range = calculateFetchRange(Number(proposalCounter), args);

    console.log(
      `Fetching proposals ${range.startId} to ${range.endId} (${range.totalToFetch} proposals)...`,
    );

    // Fetch proposals sequentially to avoid rate limiting
    const proposals: { id: number; data: ProposalData | null }[] = [];

    for (let i = range.endId; i >= range.startId; i--) {
      try {
        console.log(`Fetching proposal #${i}...`);
        const proposalData = await daoProposals.getProposalCore(i);

        const data: ProposalData = {
          spaceId: proposalData[0],
          startTime: proposalData[1],
          endTime: proposalData[2],
          executed: proposalData[3],
          expired: proposalData[4],
          yesVotes: proposalData[5],
          noVotes: proposalData[6],
          totalVotingPowerAtSnapshot: proposalData[7],
          creator: proposalData[8],
          transactions: proposalData[9],
        };

        proposals.push({ id: i, data });

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        console.warn(
          `⚠️  Failed to fetch proposal #${i}:`,
          error instanceof Error ? error.message : error,
        );
        proposals.push({ id: i, data: null });

        // Add delay even on error
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
    }

    // Display successfully fetched proposals
    let successCount = 0;
    for (const proposal of proposals) {
      if (proposal.data) {
        formatProposalData(proposal.id, proposal.data);
        successCount++;
      }
    }

    console.log(
      `\n✅ Successfully fetched ${successCount} out of ${proposals.length} proposals!`,
    );

    if (successCount === 0) {
      console.log('❌ No proposals could be fetched. This might indicate:');
      console.log('- The proposals might not exist yet');
      console.log('- There might be an issue with the contract');
      console.log('- RPC connection issues');
    }
  } catch (error) {
    console.error('❌ Error fetching proposals:', error);
    console.log('\nPossible issues:');
    console.log('1. Check your RPC_URL in .env file');
    console.log('2. Verify the DAO Proposals contract address is correct');
    console.log('3. Ensure the contract is deployed and accessible');
    console.log(
      '4. RPC provider rate limiting - try using a different RPC endpoint',
    );
  }
}

// Run the script
fetchLatestProposals().catch(console.error);
