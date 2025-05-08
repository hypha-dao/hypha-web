import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Minimal ABI with just the function we need
const minimalAbi = [
  {
    inputs: [],
    name: 'getLatestProposalId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function getLatestProposalId(): Promise<void> {
  console.log('Fetching latest proposal ID...');

  // Connect to network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Try multiple contract addresses if needed
  const contractAddresses = [
    process.env.DAO_PROPOSALS_ADDRESS,
    '0xaC840F8A96EC6A6f9FbfdAae8daF8d9D679fd48B', // Default address
    '0x9C0563DAc7fa73875aEf56807782CCC7dE8df65b', // Alternative address
  ].filter(Boolean) as string[]; // Remove undefined/null entries

  // Remove duplicates
  const uniqueAddresses = [...new Set(contractAddresses)];

  let latestProposalId: bigint | null = null;
  let successAddress: string | null = null;

  // Try each contract address until one works
  for (const address of uniqueAddresses) {
    console.log(`Trying DAO Proposals contract at: ${address}`);
    const contract = new ethers.Contract(address, minimalAbi, provider);

    try {
      latestProposalId = await contract.getLatestProposalId();
      successAddress = address;
      console.log(`Successfully connected to DAO Proposals at: ${address}`);
      break;
    } catch (error) {
      console.log(
        `Failed to get latest proposal ID from ${address}. Error: ${error.message}`,
      );
    }
  }

  if (latestProposalId !== null && successAddress !== null) {
    console.log('\n==========================================');
    console.log(`  Latest Proposal ID: ${latestProposalId}`);
    console.log(`  Contract Address: ${successAddress}`);
    console.log('==========================================');
  } else {
    console.error(
      'Could not retrieve latest proposal ID from any contract address.',
    );
    console.log(
      'Make sure your RPC_URL and contract addresses are correct in the .env file.',
    );
  }
}

// Run the script
getLatestProposalId().catch((error) => {
  console.error('Uncaught error:', error);
  process.exit(1);
});
