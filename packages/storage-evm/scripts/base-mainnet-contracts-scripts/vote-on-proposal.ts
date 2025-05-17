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
    inputs: [
      { internalType: 'uint256', name: '_proposalId', type: 'uint256' },
      { internalType: 'bool', name: '_support', type: 'bool' },
    ],
    name: 'vote',
    outputs: [],
    stateMutability: 'nonpayable',
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
];

// Helper function to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

async function voteOnProposal(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.log(
      'Usage: ts-node vote-on-proposal.ts <proposalId> <support: true|false>',
    );
    console.log('Example: ts-node vote-on-proposal.ts 123 true');
    return;
  }

  const proposalId = parseInt(args[0]);
  const support = args[1].toLowerCase() === 'true';

  if (isNaN(proposalId)) {
    console.error('Invalid proposal ID. Please provide a valid number.');
    return;
  }

  console.log(`Voting ${support ? 'YES' : 'NO'} on proposal ID: ${proposalId}`);

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Load account data
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
    }
  } catch (error) {
    console.log(
      'accounts.json not found or invalid. Using environment variables.',
    );
  }

  // If no accounts from JSON, try to use environment variable
  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;

    if (privateKey) {
      console.log('Using private key from environment variable.');
      try {
        // Remove 0x prefix if present
        const cleanPrivateKey = privateKey.startsWith('0x')
          ? privateKey.slice(2)
          : privateKey;

        const wallet = new ethers.Wallet(cleanPrivateKey);
        accountData = [
          {
            privateKey: cleanPrivateKey,
            address: wallet.address,
          },
        ];
      } catch (error) {
        console.error(
          'Invalid private key format in environment variable:',
          error,
        );
      }
    } else {
      console.error('PRIVATE_KEY not found in environment variables.');
    }
  }

  if (accountData.length === 0) {
    console.error(
      'No accounts found. Please create an accounts.json file or provide a valid PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`Using wallet address: ${wallet.address}`);

  // Initialize DAO Proposals contract
  const daoProposalsAddress =
    process.env.DAO_PROPOSALS_ADDRESS ||
    '0xaC840F8A96EC6A6f9FbfdAae8daF8d9D679fd48B';
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  );
  console.log(`Connected to DAO Proposals contract: ${daoProposals.target}`);

  try {
    // Check if proposal exists and get details
    console.log('\nFetching proposal details...');
    const proposalData = await daoProposals.getProposalCore(proposalId);

    console.log('Proposal data:');
    console.log(`- Space ID: ${proposalData.spaceId}`);
    console.log(`- Start time: ${formatDate(Number(proposalData.startTime))}`);
    console.log(`- End time: ${formatDate(Number(proposalData.endTime))}`);
    console.log(`- Executed: ${proposalData.executed}`);
    console.log(`- Expired: ${proposalData.expired}`);
    console.log(`- Yes votes: ${proposalData.yesVotes}`);
    console.log(`- No votes: ${proposalData.noVotes}`);
    console.log(
      `- Total voting power: ${proposalData.totalVotingPowerAtSnapshot}`,
    );
    console.log(`- Creator: ${proposalData.creator}`);

    // Check if the user has already voted
    const hasVoted = await daoProposals.hasVoted(proposalId, wallet.address);
    if (hasVoted) {
      console.log('\nYou have already voted on this proposal.');
      return;
    }

    // Check if proposal is active
    const currentTime = Math.floor(Date.now() / 1000);
    if (currentTime < Number(proposalData.startTime)) {
      console.log('\nVoting has not started yet.');
      return;
    }
    if (currentTime > Number(proposalData.endTime)) {
      console.log('\nVoting period has ended.');
      return;
    }
    if (proposalData.executed) {
      console.log('\nProposal has already been executed.');
      return;
    }
    if (proposalData.expired) {
      console.log('\nProposal has expired.');
      return;
    }

    // Submit the vote
    console.log(
      `\nSubmitting ${
        support ? 'YES' : 'NO'
      } vote on proposal ${proposalId}...`,
    );
    const voteTx = await daoProposals.vote(proposalId, support, {
      gasLimit: 300000, // Set a reasonable gas limit
    });
    console.log(`Vote transaction submitted: ${voteTx.hash}`);

    // Wait for transaction confirmation
    const receipt = await voteTx.wait();
    console.log('Vote transaction confirmed!');

    // Get updated proposal data
    const updatedProposalData = await daoProposals.getProposalCore(proposalId);
    console.log('\nUpdated vote counts:');
    console.log(`- Yes votes: ${updatedProposalData.yesVotes}`);
    console.log(`- No votes: ${updatedProposalData.noVotes}`);

    // Check if the proposal was executed as a result of this vote
    if (!proposalData.executed && updatedProposalData.executed) {
      console.log('\nThe proposal was executed as a result of your vote!');
    }
  } catch (error) {
    console.error('Error while voting on proposal:', error);

    if (error.message?.includes('Not a space member')) {
      console.log('\nYou are not a member of the space for this proposal.');
    } else if (error.message?.includes('Already voted')) {
      console.log('\nYou have already voted on this proposal.');
    } else if (error.message?.includes('Voting not started')) {
      console.log('\nVoting has not started yet.');
    } else if (error.message?.includes('Proposal has expired')) {
      console.log('\nProposal has expired.');
    } else if (error.message?.includes('Proposal already executed')) {
      console.log('\nProposal has already been executed.');
    } else if (error.message?.includes('No voting power')) {
      console.log('\nYou do not have any voting power in this space.');
    } else {
      console.log('\nSomething went wrong. Check the error above for details.');
    }
  }
}

// Run the script
voteOnProposal().catch(console.error);
