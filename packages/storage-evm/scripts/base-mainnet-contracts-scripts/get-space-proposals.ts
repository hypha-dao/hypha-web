import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// DAOProposals ABI with necessary functions
const daoProposalsAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceProposals',
    outputs: [
      { internalType: 'uint256[]', name: 'accepted', type: 'uint256[]' },
      { internalType: 'uint256[]', name: 'rejected', type: 'uint256[]' },
    ],
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
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

interface ProposalDetails {
  proposalId: number;
  spaceId: number;
  startTime: number;
  endTime: number;
  executed: boolean;
  expired: boolean;
  yesVotes: number;
  noVotes: number;
  totalVotingPowerAtSnapshot: number;
  creator: string;
}

async function getSpaceProposals(
  spaceId: number,
  includeDetails: boolean = true,
): Promise<void> {
  console.log(`Getting proposals for space ID: ${spaceId}`);
  console.log('='.repeat(50));

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data (for read-only operations, we don't need a wallet, but keeping for consistency)
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
    }
  } catch (error) {
    console.log('accounts.json not found. Using read-only provider.');
  }

  let signer;
  if (accountData.length > 0) {
    signer = new ethers.Wallet(accountData[0].privateKey, provider);
  } else if (process.env.PRIVATE_KEY) {
    const cleanPrivateKey = process.env.PRIVATE_KEY.startsWith('0x')
      ? process.env.PRIVATE_KEY.slice(2)
      : process.env.PRIVATE_KEY;
    signer = new ethers.Wallet(cleanPrivateKey, provider);
  } else {
    // For read-only operations, we can use just the provider
    signer = provider;
  }

  // Initialize DAO Proposals contract
  const daoProposalsAddress =
    process.env.DAO_PROPOSALS_ADDRESS ||
    '0x001bA7a00a259Fb12d7936455e292a60FC2bef14';
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    signer,
  );

  console.log(`Using DAO Proposals contract at: ${daoProposals.target}`);
  console.log('');

  try {
    // Get space proposals
    const [acceptedProposals, rejectedProposals] =
      await daoProposals.getSpaceProposals(spaceId);

    console.log(`📊 SPACE ${spaceId} PROPOSALS SUMMARY`);
    console.log('-'.repeat(50));
    console.log(`✅ Accepted Proposals: ${acceptedProposals.length}`);
    console.log(`❌ Rejected Proposals: ${rejectedProposals.length}`);
    console.log(
      `📈 Total Proposals: ${
        acceptedProposals.length + rejectedProposals.length
      }`,
    );
    console.log('');

    // Display accepted proposals
    if (acceptedProposals.length > 0) {
      console.log('✅ ACCEPTED PROPOSALS:');
      console.log('-'.repeat(30));
      for (let i = 0; i < acceptedProposals.length; i++) {
        const proposalId = Number(acceptedProposals[i]);
        console.log(`${i + 1}. Proposal ID: ${proposalId}`);

        if (includeDetails) {
          try {
            const details = await daoProposals.getProposalCore(proposalId);
            const proposalDetails: ProposalDetails = {
              proposalId,
              spaceId: Number(details.spaceId),
              startTime: Number(details.startTime),
              endTime: Number(details.endTime),
              executed: details.executed,
              expired: details.expired,
              yesVotes: Number(details.yesVotes),
              noVotes: Number(details.noVotes),
              totalVotingPowerAtSnapshot: Number(
                details.totalVotingPowerAtSnapshot,
              ),
              creator: details.creator,
            };

            console.log(`   - Creator: ${proposalDetails.creator}`);
            console.log(
              `   - Start: ${new Date(
                proposalDetails.startTime * 1000,
              ).toLocaleString()}`,
            );
            console.log(
              `   - End: ${new Date(
                proposalDetails.endTime * 1000,
              ).toLocaleString()}`,
            );
            console.log(`   - Yes Votes: ${proposalDetails.yesVotes}`);
            console.log(`   - No Votes: ${proposalDetails.noVotes}`);
            console.log(
              `   - Total Voting Power: ${proposalDetails.totalVotingPowerAtSnapshot}`,
            );
            console.log(`   - Executed: ${proposalDetails.executed}`);
            console.log(`   - Expired: ${proposalDetails.expired}`);
          } catch (error) {
            console.log(`   - Error fetching details: ${error}`);
          }
        }
        console.log('');
      }
    } else {
      console.log('✅ No accepted proposals found.');
      console.log('');
    }

    // Display rejected proposals
    if (rejectedProposals.length > 0) {
      console.log('❌ REJECTED PROPOSALS:');
      console.log('-'.repeat(30));
      for (let i = 0; i < rejectedProposals.length; i++) {
        const proposalId = Number(rejectedProposals[i]);
        console.log(`${i + 1}. Proposal ID: ${proposalId}`);

        if (includeDetails) {
          try {
            const details = await daoProposals.getProposalCore(proposalId);
            const proposalDetails: ProposalDetails = {
              proposalId,
              spaceId: Number(details.spaceId),
              startTime: Number(details.startTime),
              endTime: Number(details.endTime),
              executed: details.executed,
              expired: details.expired,
              yesVotes: Number(details.yesVotes),
              noVotes: Number(details.noVotes),
              totalVotingPowerAtSnapshot: Number(
                details.totalVotingPowerAtSnapshot,
              ),
              creator: details.creator,
            };

            console.log(`   - Creator: ${proposalDetails.creator}`);
            console.log(
              `   - Start: ${new Date(
                proposalDetails.startTime * 1000,
              ).toLocaleString()}`,
            );
            console.log(
              `   - End: ${new Date(
                proposalDetails.endTime * 1000,
              ).toLocaleString()}`,
            );
            console.log(`   - Yes Votes: ${proposalDetails.yesVotes}`);
            console.log(`   - No Votes: ${proposalDetails.noVotes}`);
            console.log(
              `   - Total Voting Power: ${proposalDetails.totalVotingPowerAtSnapshot}`,
            );
            console.log(`   - Executed: ${proposalDetails.executed}`);
            console.log(`   - Expired: ${proposalDetails.expired}`);
          } catch (error) {
            console.log(`   - Error fetching details: ${error}`);
          }
        }
        console.log('');
      }
    } else {
      console.log('❌ No rejected proposals found.');
      console.log('');
    }

    // Summary
    console.log('📋 RAW DATA:');
    console.log('-'.repeat(20));
    console.log(
      'Accepted IDs:',
      acceptedProposals.map((id) => Number(id)).join(', ') || 'None',
    );
    console.log(
      'Rejected IDs:',
      rejectedProposals.map((id) => Number(id)).join(', ') || 'None',
    );
  } catch (error) {
    console.error('Error fetching space proposals:', error);
    console.log('\nPossible issues:');
    console.log('1. Invalid space ID');
    console.log('2. Contract address is incorrect');
    console.log('3. RPC connection issues');
    console.log('4. Space does not exist');
  }
}

// Parse command line arguments
function parseArguments(): { spaceId: number; includeDetails: boolean } {
  const args = process.argv.slice(2);

  // Check for help flag
  if (args.includes('--help') || args.includes('-h')) {
    console.log('Usage: node get-space-proposals.ts [spaceId] [options]');
    console.log('');
    console.log('Arguments:');
    console.log('  spaceId          The ID of the space to query (required)');
    console.log('');
    console.log('Options:');
    console.log(
      '  --no-details     Only show proposal IDs, skip detailed information',
    );
    console.log('  --help, -h       Show this help message');
    console.log('');
    console.log('Environment Variables:');
    console.log('  SPACE_ID         Alternative way to specify space ID');
    console.log('  RPC_URL          Ethereum RPC endpoint');
    console.log('  DAO_PROPOSALS_ADDRESS  DAO Proposals contract address');
    console.log('');
    console.log('Examples:');
    console.log('  node get-space-proposals.ts 123');
    console.log('  node get-space-proposals.ts 123 --no-details');
    console.log('  SPACE_ID=123 node get-space-proposals.ts');
    process.exit(0);
  }

  let spaceId: number;
  let includeDetails = true;

  // Check for --no-details flag
  if (args.includes('--no-details')) {
    includeDetails = false;
  }

  // Get space ID from command line or environment
  const spaceIdArg = args.find((arg) => !arg.startsWith('--'));
  if (spaceIdArg) {
    spaceId = parseInt(spaceIdArg, 10);
  } else if (process.env.SPACE_ID) {
    spaceId = parseInt(process.env.SPACE_ID, 10);
  } else {
    console.error('Error: Space ID is required');
    console.log('Usage: node get-space-proposals.ts <spaceId>');
    console.log('       OR set SPACE_ID environment variable');
    console.log('       OR use --help for more information');
    process.exit(1);
  }

  if (isNaN(spaceId) || spaceId < 0) {
    console.error('Error: Invalid space ID. Must be a non-negative number.');
    process.exit(1);
  }

  return { spaceId, includeDetails };
}

// Main execution
async function main() {
  const { spaceId, includeDetails } = parseArguments();
  await getSpaceProposals(spaceId, includeDetails);
}

// Run if called directly
if (require.main === module) {
  main().catch(console.error);
}
