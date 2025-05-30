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

interface VoteDecayTokenVotingPowerInterface {
  setDecayTokenFactory: (
    decayTokenFactory: string,
  ) => Promise<ContractTransactionWithWait>;
  owner(): Promise<string>;
  decayTokenFactory(): Promise<string>;
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
    VoteDecayTokenVotingPower:
      /VoteDecayTokenVotingPower proxy deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const voteDecayTokenVotingPowerAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_decayTokenFactory',
        type: 'address',
      },
    ],
    name: 'setDecayTokenFactory',
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
    name: 'decayTokenFactory',
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
  const requiredContracts = [
    'DecayingTokenFactory',
    'VoteDecayTokenVotingPower',
  ];
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

  // Use the VoteDecayTokenVotingPower address directly from addresses.txt
  const voteDecayTokenVotingPowerAddress =
    addresses['VoteDecayTokenVotingPower'];

  console.log(
    'VoteDecayTokenVotingPower address from addresses.txt:',
    voteDecayTokenVotingPowerAddress,
  );

  // Get the VoteDecayTokenVotingPower contract instance
  const voteDecayTokenVotingPower = new ethers.Contract(
    voteDecayTokenVotingPowerAddress,
    voteDecayTokenVotingPowerAbi,
    wallet,
  ) as ethers.Contract & VoteDecayTokenVotingPowerInterface;

  // Check if the wallet is the owner
  const contractOwner = await voteDecayTokenVotingPower.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the VoteDecayTokenVotingPower contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setDecayTokenFactory',
    );
  }

  console.log(
    'Setting decay token factory in VoteDecayTokenVotingPower with the following address:',
  );
  console.log('DecayingTokenFactory:', addresses['DecayingTokenFactory']);

  try {
    const tx = await voteDecayTokenVotingPower.setDecayTokenFactory(
      addresses['DecayingTokenFactory'],
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log(
      'Decay token factory set successfully in VoteDecayTokenVotingPower!',
    );

    // Retrieve and display the set decay token factory address
    console.log('\nRetrieving the set decay token factory address...');
    const setDecayTokenFactoryAddress =
      await voteDecayTokenVotingPower.decayTokenFactory();
    console.log(
      'Current decay token factory address:',
      setDecayTokenFactoryAddress,
    );

    // Verify it matches what we set
    if (
      setDecayTokenFactoryAddress.toLowerCase() ===
      addresses['DecayingTokenFactory'].toLowerCase()
    ) {
      console.log(
        '✅ Verification successful: The retrieved address matches the one we set',
      );
    } else {
      console.log(
        '❌ Verification failed: The retrieved address does not match the one we set',
      );
      console.log('Expected:', addresses['DecayingTokenFactory']);
      console.log('Retrieved:', setDecayTokenFactoryAddress);
    }
  } catch (error: any) {
    console.error('Error setting decay token factory:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
