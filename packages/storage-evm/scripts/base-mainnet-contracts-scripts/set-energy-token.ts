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

interface EnergyDistributionInterface {
  setEnergyToken: (
    tokenAddress: string,
  ) => Promise<ContractTransactionWithWait>;
  getEnergyTokenAddress(): Promise<string>;
  isAddressWhitelisted(address: string): Promise<boolean>;
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
    EnergyDistribution: /EnergyDistribution deployed to: (0x[a-fA-F0-9]{40})/,
    EnergyToken: /EnergyToken deployed to: (0x[a-fA-F0-9]{40})/,
  };

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

// ABI for the EnergyDistribution contract (only the functions we need)
const energyDistributionAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: 'tokenAddress',
        type: 'address',
      },
    ],
    name: 'setEnergyToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getEnergyTokenAddress',
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
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'isAddressWhitelisted',
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
];

async function main(): Promise<void> {
  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Get command line arguments
  const args = process.argv.slice(2);

  let tokenAddressToSet: string;
  let energyDistributionAddress: string;

  if (args.length === 0) {
    console.error(
      'Usage: ts-node set-energy-token.ts <token-address> [energy-distribution-address]',
    );
    console.error('Example: ts-node set-energy-token.ts 0x123... [0x456...]');
    console.error(
      '\nIf energy-distribution-address is not provided, it will be read from addresses.txt',
    );
    console.error('\nAddresses from addresses.txt:');
    console.error(
      '  EnergyDistribution:',
      addresses['EnergyDistribution'] || 'Not found',
    );
    console.error('  EnergyToken:', addresses['EnergyToken'] || 'Not found');
    process.exit(1);
  }

  tokenAddressToSet = args[0];

  // Use provided address or default from addresses.txt
  if (args.length >= 2) {
    energyDistributionAddress = args[1];
  } else {
    if (!addresses['EnergyDistribution']) {
      throw new Error('EnergyDistribution address not found in addresses.txt');
    }
    energyDistributionAddress = addresses['EnergyDistribution'];
  }

  // Validate address formats
  if (!ethers.isAddress(tokenAddressToSet)) {
    throw new Error(`Invalid token address format: ${tokenAddressToSet}`);
  }

  if (!ethers.isAddress(energyDistributionAddress)) {
    throw new Error(
      `Invalid EnergyDistribution address format: ${energyDistributionAddress}`,
    );
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log(
    'EnergyDistribution contract address:',
    energyDistributionAddress,
  );
  console.log('Wallet address:', wallet.address);

  // Get the EnergyDistribution contract instance
  const energyDistribution = new ethers.Contract(
    energyDistributionAddress,
    energyDistributionAbi,
    wallet,
  ) as ethers.Contract & EnergyDistributionInterface;

  // Check if the wallet is whitelisted
  const isWhitelisted = await energyDistribution.isAddressWhitelisted(
    wallet.address,
  );
  if (!isWhitelisted) {
    console.error(
      `Your wallet (${wallet.address}) is not whitelisted on the EnergyDistribution contract.`,
    );
    throw new Error(
      'Permission denied: only whitelisted addresses can call setEnergyToken',
    );
  }

  console.log('✓ Wallet is whitelisted');

  // Get current energy token address
  let currentTokenAddress: string;
  try {
    currentTokenAddress = await energyDistribution.getEnergyTokenAddress();
    console.log('Current energy token address:', currentTokenAddress);
  } catch (error) {
    console.log('Current energy token address: Not set or error reading');
    currentTokenAddress = ethers.ZeroAddress;
  }

  if (currentTokenAddress.toLowerCase() === tokenAddressToSet.toLowerCase()) {
    console.log(
      'Energy token is already set to the specified address. No action needed.',
    );
    return;
  }

  console.log(`Setting energy token to: ${tokenAddressToSet}`);

  try {
    const tx = await energyDistribution.setEnergyToken(tokenAddressToSet);

    console.log('Transaction sent, waiting for confirmation...');
    console.log('Transaction hash:', tx.hash);
    await tx.wait();
    console.log('Energy token set successfully!');

    // Verify the change
    const newTokenAddress = await energyDistribution.getEnergyTokenAddress();
    console.log('New energy token address:', newTokenAddress);

    if (newTokenAddress.toLowerCase() === tokenAddressToSet.toLowerCase()) {
      console.log('✓ Verification successful!');
    } else {
      console.error('✗ Verification failed - addresses do not match');
    }
  } catch (error: any) {
    console.error('Error setting energy token:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
