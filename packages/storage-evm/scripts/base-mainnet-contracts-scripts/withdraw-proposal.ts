import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Add interface definitions
interface Log {
  topics: string[];
  [key: string]: any;
}

interface TransactionReceipt {
  hash: string;
  logs: Log[];
  [key: string]: any;
}

interface ContractTransactionWithWait extends ethers.ContractTransaction {
  hash: string;
  wait(): Promise<TransactionReceipt>;
}

interface DAOProposalsInterface {
  withdrawProposal: (
    proposalId: ethers.BigNumberish,
  ) => Promise<ContractTransactionWithWait>;
  isProposalWithdrawn: (proposalId: ethers.BigNumberish) => Promise<boolean>;
  getProposalCore: (proposalId: ethers.BigNumberish) => Promise<any>;
  owner(): Promise<string>;
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
    DAOProposals: /DAOProposals deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const daoProposalsAbi = [
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_proposalId',
        type: 'uint256',
      },
    ],
    name: 'withdrawProposal',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: '_proposalId',
        type: 'uint256',
      },
    ],
    name: 'isProposalWithdrawn',
    outputs: [
      {
        internalType: 'bool',
        name: '',
        type: 'bool',
      },
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
    name: 'owner',
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
];

// Helper function to format date
function formatDate(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleString();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error('Usage: ts-node withdraw-proposal.ts <proposalId>');
    console.error('');
    console.error(
      'This script withdraws a proposal. Only the proposal creator',
    );
    console.error('or the contract owner can withdraw a proposal.');
    console.error('');
    console.error('If withdrawn by the owner (not creator), the proposal will');
    console.error('also be marked as rejected.');
    process.exit(1);
  }

  const proposalId = args[0];

  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Verify all required addresses are available
  if (!addresses['DAOProposals']) {
    throw new Error('Missing address for: DAOProposals');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the DAO Proposals address directly from addresses.txt
  const daoProposalsAddress = addresses['DAOProposals'];

  console.log('DAO Proposals address from addresses.txt:', daoProposalsAddress);
  console.log('Your wallet address:', wallet.address);

  // Get the DAO Proposals contract instance
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  ) as ethers.Contract & DAOProposalsInterface;

  // Get contract owner
  const contractOwner = await daoProposals.owner();
  const isOwner = contractOwner.toLowerCase() === wallet.address.toLowerCase();

  console.log(`Contract owner: ${contractOwner}`);
  console.log(`You are ${isOwner ? '' : 'NOT '}the contract owner`);

  // Get proposal details
  console.log(`\nFetching proposal ${proposalId} details...`);

  let proposalData;
  try {
    proposalData = await daoProposals.getProposalCore(proposalId);
  } catch (error: any) {
    console.error(
      `Error: Could not fetch proposal ${proposalId}. It may not exist.`,
    );
    throw error;
  }

  const creator = proposalData.creator;
  const isCreator = creator.toLowerCase() === wallet.address.toLowerCase();
  const spaceId = proposalData.spaceId;
  const executed = proposalData.executed;
  const expired = proposalData.expired;

  console.log('\n========== PROPOSAL DETAILS ==========');
  console.log(`Proposal ID: ${proposalId}`);
  console.log(`Space ID: ${spaceId}`);
  console.log(`Creator: ${creator}`);
  console.log(`You are ${isCreator ? '' : 'NOT '}the proposal creator`);
  console.log(`Start time: ${formatDate(Number(proposalData.startTime))}`);
  console.log(`End time: ${formatDate(Number(proposalData.endTime))}`);
  console.log(`Executed: ${executed}`);
  console.log(`Expired: ${expired}`);
  console.log(`Yes votes: ${proposalData.yesVotes.toString()}`);
  console.log(`No votes: ${proposalData.noVotes.toString()}`);

  // Check if already withdrawn
  const alreadyWithdrawn = await daoProposals.isProposalWithdrawn(proposalId);
  console.log(`Already withdrawn: ${alreadyWithdrawn}`);

  if (alreadyWithdrawn) {
    console.error('\nError: This proposal has already been withdrawn.');
    process.exit(1);
  }

  if (executed) {
    console.error(
      '\nError: This proposal has already been executed and cannot be withdrawn.',
    );
    process.exit(1);
  }

  if (expired) {
    console.error(
      '\nError: This proposal has already expired and cannot be withdrawn.',
    );
    process.exit(1);
  }

  // Check authorization
  if (!isOwner && !isCreator) {
    console.error(
      '\nError: You are neither the proposal creator nor the contract owner.',
    );
    console.error('Only the creator or owner can withdraw this proposal.');
    process.exit(1);
  }

  // Display what will happen
  console.log('\n========== WITHDRAWAL PREVIEW ==========');
  if (isOwner && !isCreator) {
    console.log('⚠️  You are withdrawing as the contract OWNER (not creator).');
    console.log('   This will ALSO mark the proposal as REJECTED.');
  } else {
    console.log('You are withdrawing as the proposal creator.');
  }

  console.log(`\nWithdrawing proposal ${proposalId}...`);

  try {
    const tx = await daoProposals.withdrawProposal(proposalId);

    console.log('Transaction sent:', tx.hash);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();
    console.log('\n✅ Proposal withdrawn successfully!');
    console.log(`Transaction hash: ${receipt.hash || tx.hash}`);

    // Verify the withdrawal
    const isNowWithdrawn = await daoProposals.isProposalWithdrawn(proposalId);
    console.log(
      `\nVerification - Proposal is now withdrawn: ${isNowWithdrawn}`,
    );

    if (isOwner && !isCreator) {
      console.log(
        '\nNote: As an owner withdrawal, this proposal has also been marked as rejected.',
      );
    }
  } catch (error: any) {
    console.error('\nError withdrawing proposal:', error.message);

    // Try to provide more helpful error messages
    if (error.message.includes('Only creator or owner')) {
      console.error('You do not have permission to withdraw this proposal.');
    } else if (error.message.includes('already executed')) {
      console.error('The proposal has already been executed.');
    } else if (error.message.includes('has expired')) {
      console.error('The proposal has already expired.');
    } else if (error.message.includes('already withdrawn')) {
      console.error('The proposal has already been withdrawn.');
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
