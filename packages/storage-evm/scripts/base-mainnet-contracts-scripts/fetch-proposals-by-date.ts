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

interface DateRange {
  startDate: Date;
  endDate: Date;
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
  date?: string;
  startDate?: string;
  endDate?: string;
} {
  const args = process.argv.slice(2);
  const result: { date?: string; startDate?: string; endDate?: string } = {};

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--date':
      case '-d':
        if (args[i + 1]) {
          result.date = args[i + 1];
          i++; // skip next argument
        }
        break;
      case '--start-date':
      case '-sd':
        if (args[i + 1]) {
          result.startDate = args[i + 1];
          i++; // skip next argument
        }
        break;
      case '--end-date':
      case '-ed':
        if (args[i + 1]) {
          result.endDate = args[i + 1];
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
  console.log('Usage: ts-node fetch-proposals-by-date.ts [options]');
  console.log('');
  console.log('Options:');
  console.log(
    '  -d, --date <date>           Fetch proposals from specific date (YYYY-MM-DD)',
  );
  console.log(
    '  -sd, --start-date <date>    Start date for range (YYYY-MM-DD)',
  );
  console.log('  -ed, --end-date <date>      End date for range (YYYY-MM-DD)');
  console.log('  -h, --help                  Show this help message');
  console.log('');
  console.log('Examples:');
  console.log(
    '  ts-node fetch-proposals-by-date.ts -d 2024-09-05           # Fetch proposals from Sept 5, 2024',
  );
  console.log(
    '  ts-node fetch-proposals-by-date.ts -sd 2024-09-01 -ed 2024-09-10   # Fetch proposals from Sept 1-10, 2024',
  );
  console.log('');
  console.log(
    'Note: Dates should be in YYYY-MM-DD format. Time zone is assumed to be UTC.',
  );
}

function parseDateRange(args: {
  date?: string;
  startDate?: string;
  endDate?: string;
}): DateRange {
  if (args.date) {
    // Single date - get proposals from that entire day (UTC)
    const targetDate = new Date(args.date + 'T00:00:00.000Z');
    if (isNaN(targetDate.getTime())) {
      throw new Error(
        `Invalid date format: ${args.date}. Use YYYY-MM-DD format.`,
      );
    }

    const startDate = new Date(targetDate);
    const endDate = new Date(targetDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1); // Next day

    return { startDate, endDate };
  } else if (args.startDate && args.endDate) {
    // Date range
    const startDate = new Date(args.startDate + 'T00:00:00.000Z');
    const endDate = new Date(args.endDate + 'T23:59:59.999Z');

    if (isNaN(startDate.getTime())) {
      throw new Error(
        `Invalid start date format: ${args.startDate}. Use YYYY-MM-DD format.`,
      );
    }
    if (isNaN(endDate.getTime())) {
      throw new Error(
        `Invalid end date format: ${args.endDate}. Use YYYY-MM-DD format.`,
      );
    }
    if (startDate > endDate) {
      throw new Error('Start date cannot be after end date.');
    }

    return { startDate, endDate };
  } else {
    // Default to September 5, 2024 if no date specified
    const defaultDate = new Date('2024-09-05T00:00:00.000Z');
    const startDate = new Date(defaultDate);
    const endDate = new Date(defaultDate);
    endDate.setUTCDate(endDate.getUTCDate() + 1);

    console.log('No date specified, defaulting to September 5, 2024');
    return { startDate, endDate };
  }
}

function isProposalInDateRange(
  proposalData: ProposalData,
  dateRange: DateRange,
): boolean {
  // Check both start time and end time to see if proposal overlaps with target date range
  const proposalStartDate = new Date(Number(proposalData.startTime) * 1000);
  const proposalEndDate = new Date(Number(proposalData.endTime) * 1000);

  // Proposal overlaps with date range if:
  // - Proposal starts before date range ends AND
  // - Proposal ends after date range starts
  return (
    proposalStartDate < dateRange.endDate &&
    proposalEndDate >= dateRange.startDate
  );
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

async function fetchProposalsByDate(): Promise<void> {
  const args = parseCommandLineArgs();

  try {
    const dateRange = parseDateRange(args);

    console.log('🔍 Fetching proposals by date...\n');
    console.log(
      `Target date range: ${dateRange.startDate.toISOString()} to ${dateRange.endDate.toISOString()}`,
    );

    // Use environment RPC_URL if available, otherwise use reliable Base mainnet RPC
    const rpcUrl = process.env.RPC_URL || 'https://base-rpc.publicnode.com';

    if (!process.env.RPC_URL) {
      console.log(
        `⚠️  RPC_URL not set in environment, using reliable Base mainnet RPC: ${rpcUrl}`,
      );
      console.log('   To use a custom RPC, set RPC_URL environment variable\n');
    }

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // Use the correct DAO Proposals address from addresses.txt
    const daoProposalsAddress = '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
    const daoProposals = new ethers.Contract(
      daoProposalsAddress,
      daoProposalsAbi,
      provider,
    );

    console.log(`Connected to DAO Proposals at: ${daoProposalsAddress}`);

    // Get the current proposal counter
    const proposalCounter = await daoProposals.proposalCounter();
    console.log(`Total proposals created: ${proposalCounter}\n`);

    if (proposalCounter === 0n) {
      console.log('No proposals found.');
      return;
    }

    // Scan the last 100 proposals and show all their dates
    const proposalsToScan = 100;
    const totalProposals = Number(proposalCounter);
    const startProposal = Math.max(1, totalProposals - proposalsToScan + 1);
    const endProposal = totalProposals;

    console.log(
      `Scanning last ${
        endProposal - startProposal + 1
      } proposals (${startProposal} to ${endProposal}) and showing all dates...`,
    );

    // Check the date range of proposals we're scanning
    console.log('🔍 Determining date range of proposals to scan...');
    try {
      const firstProposalData = await daoProposals.getProposalCore(
        startProposal,
      );
      const lastProposalData = await daoProposals.getProposalCore(endProposal);

      const firstDate = new Date(Number(firstProposalData[1]) * 1000);
      const lastDate = new Date(Number(lastProposalData[1]) * 1000);

      console.log(
        `📅 Scanning proposals from: ${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()}`,
      );
      console.log(
        `   (${firstDate.toLocaleString()} to ${lastDate.toLocaleString()})`,
      );
    } catch (error) {
      console.warn('⚠️  Could not determine date range of proposals');
    }

    console.log('💡 Tip: Press Ctrl+C to stop scanning at any time\n');

    // Fetch proposals and show all their dates
    const allProposals: { id: number; data: ProposalData | null }[] = [];
    let scannedCount = 0;

    for (let i = startProposal; i <= endProposal; i++) {
      try {
        // Show progress every 10 proposals
        if (i % 10 === 0 || i === startProposal) {
          const scannedSoFar = i - startProposal + 1;
          const totalToScan = endProposal - startProposal + 1;
          console.log(
            `📊 Progress: ${scannedSoFar}/${totalToScan} (${(
              (scannedSoFar / totalToScan) *
              100
            ).toFixed(1)}%)`,
          );
        }

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

        scannedCount++;
        allProposals.push({ id: i, data });

        // Show the date for each proposal
        const startDate = new Date(Number(data.startTime) * 1000);
        const endDate = new Date(Number(data.endTime) * 1000);

        // Check if this proposal was created on September 5th (any year)
        const isSept5 = startDate.getMonth() === 8 && startDate.getDate() === 5; // Month is 0-indexed, so 8 = September
        const datePrefix = isSept5 ? '🎯 SEPTEMBER 5th! ' : '📅 ';

        console.log(
          `${datePrefix}Proposal #${i}: Start: ${startDate.toLocaleDateString()} ${startDate.toLocaleTimeString()} | End: ${endDate.toLocaleDateString()} ${endDate.toLocaleTimeString()}`,
        );

        // Add a small delay to avoid rate limiting
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (error) {
        console.warn(
          `⚠️  Failed to fetch proposal #${i}:`,
          error instanceof Error ? error.message : error,
        );
        allProposals.push({ id: i, data: null });

        // Add delay even on error
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Display results
    console.log(`\n📊 SCAN RESULTS:`);
    console.log(
      `Scanned: ${scannedCount} proposals (latest ${
        endProposal - startProposal + 1
      } of ${totalProposals} total)`,
    );

    // Filter proposals that were created on September 5th (any year)
    const sept5Proposals = allProposals.filter((p) => {
      if (!p.data) return false;
      const startDate = new Date(Number(p.data.startTime) * 1000);
      return startDate.getMonth() === 8 && startDate.getDate() === 5; // September 5th
    });

    console.log(
      `\n🎯 Found: ${sept5Proposals.length} proposals created on September 5th (any year)`,
    );

    if (sept5Proposals.length > 0) {
      console.log(`\n🎯 SEPTEMBER 5th PROPOSALS:`);
      // Sort by proposal ID (newest first)
      sept5Proposals.sort((a, b) => b.id - a.id);

      for (const proposal of sept5Proposals) {
        if (proposal.data) {
          const startDate = new Date(Number(proposal.data.startTime) * 1000);
          console.log(
            `\n🎯 Proposal #${
              proposal.id
            } - Created on September 5, ${startDate.getFullYear()}`,
          );
          formatProposalData(proposal.id, proposal.data);
        }
      }
    } else {
      console.log(
        `\n❌ No proposals found that were created on September 5th in the scanned range.`,
      );
      console.log(
        `You can see all the proposal dates above. Try scanning a different range if needed.`,
      );
    }
  } catch (error) {
    console.error('❌ Error fetching proposals:', error);
    console.log('\nPossible issues:');
    console.log('1. Check your RPC_URL in .env file');
    console.log('2. Verify the DAO Proposals contract address is correct');
    console.log('3. Ensure the contract is deployed and accessible');
    console.log('4. Check date format (should be YYYY-MM-DD)');
    console.log(
      '5. RPC provider rate limiting - try using a different RPC endpoint',
    );
  }
}

// Run the script
fetchProposalsByDate().catch(console.error);
