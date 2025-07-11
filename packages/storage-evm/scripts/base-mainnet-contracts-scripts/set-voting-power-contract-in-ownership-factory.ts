import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Interface for the contract methods we'll use
interface OwnershipTokenFactoryInterface {
  setVotingPowerContract(votingPowerContract: string): Promise<any>;
  owner(): Promise<string>;
}

// Function to parse addresses from addresses.txt file
function parseAddressesFile(): { [key: string]: string } {
  const addresses: { [key: string]: string } = {};

  try {
    // Get the script's directory and resolve the path to addresses.txt
    const scriptDir = __dirname;
    const possiblePaths = [
      './contracts/addresses.txt', // relative to current working directory
      '../../contracts/addresses.txt', // relative to script location
      path.join(scriptDir, '../../contracts/addresses.txt'), // absolute path from script location
      '../../../contracts/addresses.txt',
    ];

    let content = '';
    let foundPath = '';

    for (const filePath of possiblePaths) {
      try {
        content = fs.readFileSync(filePath, 'utf-8');
        foundPath = filePath;
        break;
      } catch (error) {
        continue;
      }
    }

    if (!content) {
      throw new Error('addresses.txt not found in any expected location');
    }

    console.log(`Reading addresses from: ${foundPath}`);
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();
      if (
        trimmedLine &&
        !trimmedLine.startsWith('BASE MAINNET') &&
        !trimmedLine.startsWith('Deploying') &&
        !trimmedLine.startsWith('ID ') &&
        !trimmedLine.startsWith('OLD ') &&
        !trimmedLine.includes('with admin address') &&
        !trimmedLine.includes('successfully')
      ) {
        // Look for lines like "ContractName deployed to: 0x..."
        const deployedMatch = trimmedLine.match(
          /^(.+?)\s+deployed to:\s+(0x[a-fA-F0-9]+)/,
        );
        if (deployedMatch) {
          const contractName = deployedMatch[1].trim();
          const address = deployedMatch[2].trim();
          addresses[contractName] = address;
          console.log(`Found ${contractName}: ${address}`);
        }

        // Look for lines like "ContractName proxy deployed to: 0x..."
        const proxyMatch = trimmedLine.match(
          /^(.+?)\s+proxy deployed to:\s+(0x[a-fA-F0-9]+)/,
        );
        if (proxyMatch) {
          const contractName = proxyMatch[1].trim();
          const address = proxyMatch[2].trim();
          addresses[contractName] = address;
          console.log(`Found ${contractName}: ${address}`);
        }
      }
    }
  } catch (error) {
    console.warn(
      'Could not read addresses.txt file, using environment variables only',
    );
    console.warn('Error:', error instanceof Error ? error.message : error);
  }

  return addresses;
}

const ownershipTokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_votingPowerContract',
        type: 'address',
      },
    ],
    name: 'setVotingPowerContract',
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

  // Get contract addresses - try environment variables first, then addresses.txt
  const ownershipTokenFactoryAddress =
    process.env.OWNERSHIP_TOKEN_FACTORY_ADDRESS ||
    addresses['OwnershipTokenFactory'];

  const ownershipTokenVotingPowerAddress =
    process.env.OWNERSHIP_TOKEN_VOTING_POWER_ADDRESS ||
    addresses['OwnershipTokenVotingPower'];

  // Verify all required addresses are available
  if (!ownershipTokenFactoryAddress) {
    throw new Error(
      'OwnershipTokenFactory address not found. Set OWNERSHIP_TOKEN_FACTORY_ADDRESS environment variable or ensure it exists in addresses.txt',
    );
  }

  if (!ownershipTokenVotingPowerAddress) {
    throw new Error(
      'OwnershipTokenVotingPower address not found. Set OWNERSHIP_TOKEN_VOTING_POWER_ADDRESS environment variable or ensure it exists in addresses.txt',
    );
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  console.log(
    `Connected to network: ${await provider.getNetwork().then((n) => n.name)}`,
  );

  // Create a wallet instance
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  const cleanPrivateKey = privateKey.startsWith('0x')
    ? privateKey.slice(2)
    : privateKey;
  const wallet = new ethers.Wallet(cleanPrivateKey, provider);

  console.log('Using wallet address:', wallet.address);
  console.log('OwnershipTokenFactory address:', ownershipTokenFactoryAddress);
  console.log(
    'OwnershipTokenVotingPower address:',
    ownershipTokenVotingPowerAddress,
  );

  // Get the OwnershipTokenFactory contract instance
  const ownershipTokenFactory = new ethers.Contract(
    ownershipTokenFactoryAddress,
    ownershipTokenFactoryAbi,
    wallet,
  ) as ethers.Contract & OwnershipTokenFactoryInterface;

  try {
    // Check if the wallet is the owner
    const contractOwner = await ownershipTokenFactory.owner();
    console.log('Contract owner:', contractOwner);

    if (wallet.address.toLowerCase() !== contractOwner.toLowerCase()) {
      throw new Error(
        `Wallet address ${wallet.address} is not the contract owner ${contractOwner}`,
      );
    }

    // Set the voting power contract
    console.log('\nSetting voting power contract...');
    const tx = await ownershipTokenFactory.setVotingPowerContract(
      ownershipTokenVotingPowerAddress,
    );

    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for transaction confirmation...');

    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());

    console.log('\n✅ Successfully set voting power contract!');
    console.log(
      `OwnershipTokenFactory (${ownershipTokenFactoryAddress}) now recognizes`,
    );
    console.log(
      `OwnershipTokenVotingPower (${ownershipTokenVotingPowerAddress}) as the voting power contract.`,
    );
    console.log(
      '\nThis allows the factory to register ownership tokens as voting tokens automatically.',
    );
  } catch (error) {
    console.error('Error setting voting power contract:', error);

    if (error instanceof Error) {
      if (error.message.includes('revert')) {
        console.log('\nTransaction reverted. Possible reasons:');
        console.log('- Wallet is not the contract owner');
        console.log('- Voting power contract address is zero address');
        console.log('- Contract is paused or has other restrictions');
      }
    }

    throw error;
  }
}

// Display usage information
function displayUsage() {
  console.log(
    'This script sets the voting power contract address in the OwnershipTokenFactory contract.',
  );
  console.log('');
  console.log(
    'This enables the OwnershipTokenFactory to automatically register ownership tokens as voting tokens',
  );
  console.log('when deployOwnershipToken() is called with isVotingToken=true.');
  console.log('');
  console.log('Required Environment Variables:');
  console.log('  RPC_URL                              - The RPC endpoint URL');
  console.log(
    '  PRIVATE_KEY                          - Private key of the contract owner',
  );
  console.log('');
  console.log(
    'Contract Address Environment Variables (optional if addresses.txt exists):',
  );
  console.log(
    '  OWNERSHIP_TOKEN_FACTORY_ADDRESS      - Address of the OwnershipTokenFactory contract',
  );
  console.log(
    '  OWNERSHIP_TOKEN_VOTING_POWER_ADDRESS - Address of the OwnershipTokenVotingPower contract',
  );
  console.log('');
  console.log('Usage:');
  console.log('  ts-node set-voting-power-contract-in-ownership-factory.ts');
}

// Check if help was requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  displayUsage();
  process.exit(0);
}

// Run the script
main()
  .then(() => {
    console.log('\nScript completed successfully!');
    process.exit(0);
  })
  .catch((error: Error) => {
    console.error('Script failed:', error.message);
    process.exit(1);
  });
