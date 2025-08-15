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

interface VotingPowerInterface {
  setDelegationContract: (
    delegationContract: string,
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

  // Extract contract addresses using regex
  const patterns = {
    SpaceVotingPower: /SpaceVotingPower deployed to: (0x[a-fA-F0-9]{40})/,
    TokenVotingPower: /TokenVotingPower deployed to: (0x[a-fA-F0-9]{40})/,
    VoteDecayTokenVotingPower: /VoteDecayTokenVotingPower proxy deployed to: (0x[a-fA-F0-9]{40})/,
    VotingPowerDelegation: /VotingPowerDelegation deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const votingPowerAbi = [
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
  const requiredAddresses = [
    'SpaceVotingPower',
    'TokenVotingPower', 
    'VoteDecayTokenVotingPower',
    'VotingPowerDelegation'
  ];

  for (const contractName of requiredAddresses) {
    if (!addresses[contractName]) {
      throw new Error(`Missing ${contractName} address in addresses.txt`);
    }
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const delegationAddress = addresses['VotingPowerDelegation'];
  console.log('VotingPowerDelegation address:', delegationAddress);
  console.log('Setting delegation contract on all voting power contracts...\n');

  // Define the contracts to update
  const contractsToUpdate = [
    { name: 'SpaceVotingPower', address: addresses['SpaceVotingPower'] },
    { name: 'TokenVotingPower', address: addresses['TokenVotingPower'] },
    { name: 'VoteDecayTokenVotingPower', address: addresses['VoteDecayTokenVotingPower'] },
  ];

  // Process each contract
  for (const contractInfo of contractsToUpdate) {
    console.log(`\n--- Processing ${contractInfo.name} ---`);
    console.log(`Contract address: ${contractInfo.address}`);

    // Get the contract instance
    const contract = new ethers.Contract(
      contractInfo.address,
      votingPowerAbi,
      wallet,
    ) as ethers.Contract & VotingPowerInterface;

    try {
      // Check if the wallet is the owner
      const contractOwner = await contract.owner();
      if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(
          `❌ Your wallet (${wallet.address}) is not the owner of ${contractInfo.name}.`,
        );
        console.error(`The owner is: ${contractOwner}`);
        throw new Error(
          `Permission denied: only the contract owner can call setDelegationContract on ${contractInfo.name}`,
        );
      }

      console.log(`✅ Wallet is owner of ${contractInfo.name}`);

      // Set the delegation contract
      console.log(`Setting delegation contract to: ${delegationAddress}`);
      const tx = await contract.setDelegationContract(delegationAddress);

      console.log('Transaction sent, waiting for confirmation...');
      await tx.wait();
      console.log(`✅ Delegation contract set successfully on ${contractInfo.name}!`);

    } catch (error: any) {
      console.error(`❌ Error setting delegation contract on ${contractInfo.name}:`, error.message);
      throw error;
    }
  }

  console.log('\n🎉 All delegation contracts set successfully!');
  console.log('\nSummary:');
  console.log(`- SpaceVotingPower: ${addresses['SpaceVotingPower']}`);
  console.log(`- TokenVotingPower: ${addresses['TokenVotingPower']}`);
  console.log(`- VoteDecayTokenVotingPower: ${addresses['VoteDecayTokenVotingPower']}`);
  console.log(`- All now linked to VotingPowerDelegation: ${delegationAddress}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 