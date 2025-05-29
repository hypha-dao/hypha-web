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

interface DecayingTokenFactoryInterface {
  setProposalsContract: (
    proposalsContract: string,
  ) => Promise<ContractTransactionWithWait>;
  owner(): Promise<string>;
  proposalsContract(): Promise<string>;
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
    DecayingTokenFactory:
      /DecayingTokenFactory proxy deployed to: (0x[a-fA-F0-9]{40})/,
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

const decayingTokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_proposalsContract',
        type: 'address',
      },
    ],
    name: 'setProposalsContract',
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
  {
    inputs: [],
    name: 'proposalsContract',
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
  const requiredContracts = ['DecayingTokenFactory', 'DAOProposals'];
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

  // Use the DecayingTokenFactory address directly from addresses.txt
  const decayingTokenFactoryAddress = addresses['DecayingTokenFactory'];

  console.log(
    'DecayingTokenFactory address from addresses.txt:',
    decayingTokenFactoryAddress,
  );

  // Get the DecayingTokenFactory contract instance
  const decayingTokenFactory = new ethers.Contract(
    decayingTokenFactoryAddress,
    decayingTokenFactoryAbi,
    wallet,
  ) as ethers.Contract & DecayingTokenFactoryInterface;

  // Check if the wallet is the owner
  const contractOwner = await decayingTokenFactory.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the DecayingTokenFactory contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setProposalsContract',
    );
  }

  console.log(
    'Setting proposals contract in DecayingTokenFactory with the following address:',
  );
  console.log('DAOProposals:', addresses['DAOProposals']);

  try {
    const tx = await decayingTokenFactory.setProposalsContract(
      addresses['DAOProposals'],
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log(
      'Proposals contract set successfully in DecayingTokenFactory!',
    );

    // Retrieve and display the set proposals contract address
    console.log('\nRetrieving the set proposals contract address...');
    const setProposalsContractAddress =
      await decayingTokenFactory.proposalsContract();
    console.log(
      'Current proposals contract address:',
      setProposalsContractAddress,
    );

    // Verify it matches what we set
    if (
      setProposalsContractAddress.toLowerCase() ===
      addresses['DAOProposals'].toLowerCase()
    ) {
      console.log(
        '✅ Verification successful: The retrieved address matches the one we set',
      );
    } else {
      console.log(
        '❌ Verification failed: The retrieved address does not match the one we set',
      );
      console.log('Expected:', addresses['DAOProposals']);
      console.log('Retrieved:', setProposalsContractAddress);
    }
  } catch (error: any) {
    console.error('Error setting proposals contract:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 