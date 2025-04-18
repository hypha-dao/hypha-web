import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// You can define default addresses here for convenience
// These will be used if the corresponding environment variables are not set
const DEFAULT_VOTING_POWER_SOURCE_ADDRESS =
  '0x6dB5E05B21c68550B63a7404a3B68F81c159DAee'; // Add your address here when needed

// Interface definitions
interface Log {
  topics: string[];
  [key: string]: any;
}

interface TransactionReceipt {
  logs: Log[];
  [key: string]: any;
}

interface ContractTransactionWithWait extends ethers.ContractTransaction {
  wait(): Promise<TransactionReceipt>;
}

interface VotingPowerDirectoryInterface {
  addVotingPowerSource: (
    contractAddress: string,
  ) => Promise<ContractTransactionWithWait>;
}

const votingPowerDirectoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_contractAddress',
        type: 'address',
      },
    ],
    name: 'addVotingPowerSource',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Get the contract address from .env
  const contractAddress = process.env.VOTING_POWER_DIRECTORY_ADDRESS || '';

  // Get the voting power source address from .env or use the default
  const votingPowerSourceAddress =
    process.env.VOTING_POWER_SOURCE_ADDRESS ||
    DEFAULT_VOTING_POWER_SOURCE_ADDRESS;

  // Ensure addresses are provided
  if (!contractAddress) {
    throw new Error(
      'VOTING_POWER_DIRECTORY_ADDRESS not set in environment variables',
    );
  }

  if (!votingPowerSourceAddress) {
    throw new Error(
      'Voting power source address not specified. Either set VOTING_POWER_SOURCE_ADDRESS ' +
        'in environment variables or update DEFAULT_VOTING_POWER_SOURCE_ADDRESS in the script.',
    );
  }

  // Get the contract instance
  const VotingPowerDirectory = new ethers.Contract(
    contractAddress,
    votingPowerDirectoryAbi,
    wallet,
  ) as ethers.Contract & VotingPowerDirectoryInterface;

  console.log(
    `Adding voting power source ${votingPowerSourceAddress} to directory ${contractAddress}...`,
  );

  // Add the voting power source
  const tx = await VotingPowerDirectory.addVotingPowerSource(
    votingPowerSourceAddress,
  );
  const receipt = await tx.wait();

  // Extract the sourceId from the event logs
  const eventTopic = ethers.id('VotingPowerSourceAdded(uint256,address)');
  const log = receipt.logs.find((log) => log.topics[0] === eventTopic);

  if (log) {
    const sourceId = parseInt(log.topics[1], 16);
    console.log(`Voting power source added successfully with ID: ${sourceId}`);
  } else {
    console.log('Voting power source added successfully!');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
