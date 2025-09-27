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
  logs: Log[];
  [key: string]: any;
}

interface ContractTransactionWithWait extends ethers.ContractTransaction {
  wait(): Promise<TransactionReceipt>;
}

interface DAOProposalsInterface {
  setDelegationContract: (
    delegationContractAddress: string,
  ) => Promise<ContractTransactionWithWait>;
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

  // Extract contract addresses using regex - updated to match your addresses.txt format
  const patterns = {
    DAOProposals: /DAOProposals deployed to: (0x[a-fA-F0-9]{40})/,
    VotingPowerDelegation:
      /VotingPowerDelegation deployed to: (0x[a-fA-F0-9]{40})/,
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
        internalType: 'address',
        name: '_delegationContract',
        type: 'address',
      },
    ],
    name: 'setDelegationContract',
    outputs: [],
    stateMutability: 'nonpayable',
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

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Verify all required addresses are available
  const requiredContracts = ['DAOProposals', 'VotingPowerDelegation'];
  const missingContracts = requiredContracts.filter(
    (contract) => !addresses[contract],
  );

  if (missingContracts.length > 0) {
    throw new Error(`Missing addresses for: ${missingContracts.join(', ')}`);
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  // Use the DAO Proposals address directly from addresses.txt
  const daoProposalsAddress = addresses['DAOProposals'];

  console.log('DAO Proposals address from addresses.txt:', daoProposalsAddress);

  // Get the DAO Proposals contract instance
  const daoProposals = new ethers.Contract(
    daoProposalsAddress,
    daoProposalsAbi,
    wallet,
  ) as ethers.Contract & DAOProposalsInterface;

  // Check if the wallet is the owner
  const contractOwner = await daoProposals.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the DAOProposals contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setDelegationContract',
    );
  }

  console.log(
    'Setting delegation contract in DAOProposals with the following address:',
  );
  console.log('VotingPowerDelegation:', addresses['VotingPowerDelegation']);

  try {
    const tx = await daoProposals.setDelegationContract(
      addresses['VotingPowerDelegation'],
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Delegation contract set successfully in DAOProposals!');
  } catch (error: any) {
    console.error('Error setting delegation contract:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
