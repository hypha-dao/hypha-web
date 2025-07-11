import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Interface for the contract methods we'll use
interface TokenVotingPowerInterface {
  setTokenFactory(tokenFactory: string): Promise<any>;
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

const tokenVotingPowerAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_tokenFactory',
        type: 'address',
      },
    ],
    name: 'setTokenFactory',
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
  const tokenVotingPowerAddress =
    process.env.TOKEN_VOTING_POWER_ADDRESS || addresses['TokenVotingPower'];

  const regularTokenFactoryAddress =
    process.env.REGULAR_TOKEN_FACTORY_ADDRESS ||
    addresses['RegularTokenFactory'];

  // Verify all required addresses are available
  if (!tokenVotingPowerAddress) {
    throw new Error(
      'TokenVotingPower address not found. Set TOKEN_VOTING_POWER_ADDRESS environment variable or ensure it exists in addresses.txt',
    );
  }

  if (!regularTokenFactoryAddress) {
    throw new Error(
      'RegularTokenFactory address not found. Set REGULAR_TOKEN_FACTORY_ADDRESS environment variable or ensure it exists in addresses.txt',
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
  console.log('TokenVotingPower address:', tokenVotingPowerAddress);
  console.log('RegularTokenFactory address:', regularTokenFactoryAddress);

  // Get the TokenVotingPower contract instance
  const tokenVotingPower = new ethers.Contract(
    tokenVotingPowerAddress,
    tokenVotingPowerAbi,
    wallet,
  ) as ethers.Contract & TokenVotingPowerInterface;

  try {
    // Check if the wallet is the owner
    const contractOwner = await tokenVotingPower.owner();
    console.log('Contract owner:', contractOwner);

    if (wallet.address.toLowerCase() !== contractOwner.toLowerCase()) {
      throw new Error(
        `Wallet address ${wallet.address} is not the contract owner ${contractOwner}`,
      );
    }

    // Set the token factory
    console.log('\nSetting token factory...');
    const tx = await tokenVotingPower.setTokenFactory(
      regularTokenFactoryAddress,
    );

    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for transaction confirmation...');

    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    console.log('Gas used:', receipt.gasUsed.toString());

    console.log('\n✅ Successfully set token factory!');
    console.log(`TokenVotingPower (${tokenVotingPowerAddress}) now recognizes`);
    console.log(
      `RegularTokenFactory (${regularTokenFactoryAddress}) as the authorized factory.`,
    );
  } catch (error) {
    console.error('Error setting token factory:', error);

    if (error instanceof Error) {
      if (error.message.includes('revert')) {
        console.log('\nTransaction reverted. Possible reasons:');
        console.log('- Wallet is not the contract owner');
        console.log('- Token factory address is zero address');
        console.log('- Contract is paused or has other restrictions');
      }
    }

    throw error;
  }
}

// Display usage information
function displayUsage() {
  console.log(
    'This script sets the token factory address in the TokenVotingPower contract.',
  );
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
    '  TOKEN_VOTING_POWER_ADDRESS           - Address of the TokenVotingPower contract',
  );
  console.log(
    '  REGULAR_TOKEN_FACTORY_ADDRESS        - Address of the RegularTokenFactory contract',
  );
  console.log('');
  console.log('Usage:');
  console.log('  ts-node set-token-factory-in-voting-power.ts');
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
