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
  hash: string;
  wait(): Promise<TransactionReceipt>;
}

interface VotingPowerContractInterface {
  setSpaceFactory: (
    spaceFactoryAddress: string,
  ) => Promise<ContractTransactionWithWait>;
  owner(): Promise<string>;
  spaceFactory(): Promise<string>;
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
    DAOSpaceFactory: /DAOSpaceFactory deployed to: (0x[a-fA-F0-9]{40})/,
    TokenVotingPower: /TokenVotingPower deployed to: (0x[a-fA-F0-9]{40})/,
    VoteDecayTokenVotingPower:
      /VoteDecayTokenVotingPower proxy deployed to: (0x[a-fA-F0-9]{40})/,
    OwnershipTokenVotingPower:
      /OwnershipTokenVotingPower proxy deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

// Common ABI for all voting power contracts (they all have setSpaceFactory, owner, and spaceFactory methods)
const votingPowerContractAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_spaceFactory',
        type: 'address',
      },
    ],
    name: 'setSpaceFactory',
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
    name: 'spaceFactory',
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

async function setSpaceFactoryInContract(
  contractName: string,
  contractAddress: string,
  spaceFactoryAddress: string,
  wallet: ethers.Wallet,
): Promise<void> {
  console.log(`\n=== Setting space factory in ${contractName} ===`);
  console.log(`Contract address: ${contractAddress}`);

  const contract = new ethers.Contract(
    contractAddress,
    votingPowerContractAbi,
    wallet,
  ) as ethers.Contract & VotingPowerContractInterface;

  try {
    // Check current owner
    const contractOwner = await contract.owner();
    if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
      console.error(
        `❌ Your wallet (${wallet.address}) is not the owner of ${contractName}.`,
      );
      console.error(`The owner is: ${contractOwner}`);
      return;
    }
    console.log(`✅ Wallet is owner of ${contractName}`);

    // Check current space factory setting
    const currentSpaceFactory = await contract.spaceFactory();
    console.log(`Current space factory: ${currentSpaceFactory}`);

    if (
      currentSpaceFactory.toLowerCase() === spaceFactoryAddress.toLowerCase()
    ) {
      console.log(`✅ Space factory already set correctly in ${contractName}`);
      return;
    }

    // Set the space factory
    console.log(`Setting space factory to: ${spaceFactoryAddress}`);
    const tx = await contract.setSpaceFactory(spaceFactoryAddress);

    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');
    await tx.wait();
    console.log(`✅ Space factory set successfully in ${contractName}!`);

    // Verify the setting
    const newSpaceFactory = await contract.spaceFactory();
    if (newSpaceFactory.toLowerCase() === spaceFactoryAddress.toLowerCase()) {
      console.log(
        `✅ Verification successful: Space factory correctly set in ${contractName}`,
      );
    } else {
      console.error(
        `❌ Verification failed: Space factory not set correctly in ${contractName}`,
      );
    }
  } catch (error: any) {
    console.error(
      `❌ Error setting space factory in ${contractName}:`,
      error.message,
    );
  }
}

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Verify all required addresses are available
  const requiredContracts = [
    'DAOSpaceFactory',
    'TokenVotingPower',
    'VoteDecayTokenVotingPower',
    'OwnershipTokenVotingPower',
  ];
  const missingContracts = requiredContracts.filter(
    (contract) => !addresses[contract],
  );

  if (missingContracts.length > 0) {
    throw new Error(`Missing addresses for: ${missingContracts.join(', ')}`);
  }

  console.log('Found addresses:');
  console.log(`- DAOSpaceFactory: ${addresses['DAOSpaceFactory']}`);
  console.log(`- TokenVotingPower: ${addresses['TokenVotingPower']}`);
  console.log(
    `- VoteDecayTokenVotingPower: ${addresses['VoteDecayTokenVotingPower']}`,
  );
  console.log(
    `- OwnershipTokenVotingPower: ${addresses['OwnershipTokenVotingPower']}`,
  );

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);
  console.log(`\nUsing wallet: ${wallet.address}`);

  const spaceFactoryAddress = addresses['DAOSpaceFactory'];

  // Define the contracts to update
  const contractsToUpdate = [
    {
      name: 'TokenVotingPowerImplementation',
      address: addresses['TokenVotingPower'],
    },
    {
      name: 'VoteDecayTokenVotingPowerImplementation',
      address: addresses['VoteDecayTokenVotingPower'],
    },
    {
      name: 'OwnershipTokenVotingPowerImplementation',
      address: addresses['OwnershipTokenVotingPower'],
    },
  ];

  console.log(
    `\nSetting space factory address (${spaceFactoryAddress}) in all voting power contracts...`,
  );

  // Set space factory in each contract
  for (const contractInfo of contractsToUpdate) {
    await setSpaceFactoryInContract(
      contractInfo.name,
      contractInfo.address,
      spaceFactoryAddress,
      wallet,
    );
  }

  console.log('\n=== Summary ===');
  console.log(
    '✅ Space factory configuration completed for all voting power contracts!',
  );
  console.log(`Space factory address: ${spaceFactoryAddress}`);
  console.log('Updated contracts:');
  contractsToUpdate.forEach((contract) => {
    console.log(`- ${contract.name}: ${contract.address}`);
  });
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
