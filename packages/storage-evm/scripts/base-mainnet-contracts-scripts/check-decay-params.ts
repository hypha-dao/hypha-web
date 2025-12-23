import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const decayingSpaceTokenAbi = [
  {
    inputs: [],
    name: 'name',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decayRate',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decayPercentage',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'archived',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'transferable',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'executor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'spaceId',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'maxSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'useTransferWhitelist',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'useReceiveWhitelist',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalBurnedFromDecay',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
];

interface ParsedArgs {
  tokenAddress?: string;
}

function parseArguments(): ParsedArgs {
  const args = process.argv.slice(2);
  const result: ParsedArgs = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--token' && i + 1 < args.length) {
      result.tokenAddress = args[i + 1];
      i++;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx check-decay-params.ts --token <ADDRESS>

Options:
  --token <string>    The address of the DecayingSpaceToken
  --help, -h          Show this help message

Example:
  npx tsx check-decay-params.ts --token 0xA2F352351A97b505115D7e4c5d048105A7B42285
      `);
      process.exit(0);
    } else if (!arg.startsWith('--') && !result.tokenAddress) {
      // Allow positional argument for token address
      result.tokenAddress = arg;
    }
  }

  return result;
}

async function main(): Promise<void> {
  const { tokenAddress } = parseArguments();

  if (!tokenAddress) {
    console.error('Error: --token <ADDRESS> is required.');
    console.log('Run with --help for usage information.');
    process.exit(1);
  }

  console.log('Checking decay parameters for token:', tokenAddress);
  console.log('='.repeat(60));

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Get the contract instance
  const token = new ethers.Contract(tokenAddress, decayingSpaceTokenAbi, provider);

  // Basic token info
  try {
    const name = await token.name();
    const symbol = await token.symbol();
    const totalSupply = await token.totalSupply();
    console.log('\n📋 Basic Token Info:');
    console.log('  Name:', name);
    console.log('  Symbol:', symbol);
    console.log('  Total Supply:', ethers.formatEther(totalSupply));
  } catch (error: any) {
    console.log('❌ Error reading basic token info:', error.message);
  }

  // Decay parameters
  try {
    const decayRate = await token.decayRate();
    const decayPercentage = await token.decayPercentage();

    console.log('\n⏱️  Decay Parameters:');
    console.log('  Decay Rate (interval in seconds):', decayRate.toString());

    if (decayRate === 0n) {
      console.log(
        '  ⚠️  WARNING: decayRate is 0! This will cause division by zero errors!',
      );
      console.log('  This likely means the token was not properly initialized.');
    } else {
      // Convert to human readable time
      const seconds = Number(decayRate);
      const minutes = seconds / 60;
      const hours = minutes / 60;
      const days = hours / 24;

      if (days >= 1) {
        console.log(`  Decay Rate (human readable): ${days.toFixed(2)} days`);
      } else if (hours >= 1) {
        console.log(`  Decay Rate (human readable): ${hours.toFixed(2)} hours`);
      } else if (minutes >= 1) {
        console.log(`  Decay Rate (human readable): ${minutes.toFixed(2)} minutes`);
      } else {
        console.log(`  Decay Rate (human readable): ${seconds} seconds`);
      }
    }

    console.log('  Decay Percentage (basis points):', decayPercentage.toString());
    console.log(
      '  Decay Percentage (%):',
      (Number(decayPercentage) / 100).toFixed(2) + '%',
    );
  } catch (error: any) {
    console.log('❌ Error reading decay parameters:', error.message);
  }

  // Other relevant state
  try {
    const archived = await token.archived();
    const transferable = await token.transferable();
    const executor = await token.executor();
    const spaceId = await token.spaceId();
    const maxSupply = await token.maxSupply();

    console.log('\n🔧 Token State:');
    console.log('  Archived:', archived);
    console.log('  Transferable:', transferable);
    console.log('  Executor:', executor);
    console.log('  Space ID:', spaceId.toString());
    console.log('  Max Supply:', ethers.formatEther(maxSupply));
  } catch (error: any) {
    console.log('❌ Error reading token state:', error.message);
  }

  // Whitelist settings
  try {
    const useTransferWhitelist = await token.useTransferWhitelist();
    const useReceiveWhitelist = await token.useReceiveWhitelist();

    console.log('\n📝 Whitelist Settings:');
    console.log('  Use Transfer Whitelist:', useTransferWhitelist);
    console.log('  Use Receive Whitelist:', useReceiveWhitelist);
  } catch (error: any) {
    console.log('❌ Error reading whitelist settings:', error.message);
  }

  // Total burned from decay
  try {
    const totalBurnedFromDecay = await token.totalBurnedFromDecay();
    console.log('\n🔥 Decay Statistics:');
    console.log(
      '  Total Burned From Decay:',
      ethers.formatEther(totalBurnedFromDecay),
    );
  } catch (error: any) {
    console.log('❌ Error reading decay statistics:', error.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log('Done!');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });

