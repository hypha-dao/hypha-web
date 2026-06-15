import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

interface TokenMetadataInterface {
  name: () => Promise<string>;
  symbol: () => Promise<string>;
  decimals: () => Promise<bigint>;
}

// Minimal ERC20 metadata ABI - only the read-only functions we need
const tokenAbi = [
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
    name: 'decimals',
    outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
];

function parseArguments(): { tokenAddress?: string } {
  const args = process.argv.slice(2);
  const result: { tokenAddress?: string } = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if ((arg === '--token' || arg === '--address') && i + 1 < args.length) {
      result.tokenAddress = args[i + 1];
      i++; // Skip the value
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
Usage: npx tsx fetch-token-symbol-and-name.ts [options]

Reads the on-chain ERC20 metadata (name, symbol, decimals) for a token contract.

Options:
  --token, --address <address>   Token contract address to inspect
  --help, -h                     Show this help message

Environment variables:
  RPC_URL          RPC endpoint (e.g. Base Mainnet)
  TOKEN_ADDRESS    Default token address used when --token is omitted

Examples:
  npx tsx fetch-token-symbol-and-name.ts --token 0x1234...
  TOKEN_ADDRESS=0x1234... npx tsx fetch-token-symbol-and-name.ts
      `);
      process.exit(0);
    } else if (!arg.startsWith('--') && !result.tokenAddress) {
      // Allow passing the address as a positional argument
      result.tokenAddress = arg;
    }
  }

  return result;
}

async function fetchTokenMetadata(
  tokenAddress: string,
  provider: ethers.JsonRpcProvider,
): Promise<{ name: string; symbol: string; decimals: number }> {
  const token = new ethers.Contract(
    tokenAddress,
    tokenAbi,
    provider,
  ) as ethers.Contract & TokenMetadataInterface;

  // Read the metadata fields in parallel
  const [name, symbol, decimals] = await Promise.all([
    token.name(),
    token.symbol(),
    token.decimals(),
  ]);

  return { name, symbol, decimals: Number(decimals) };
}

async function main(): Promise<void> {
  if (!process.env.RPC_URL) {
    throw new Error('Missing required environment variable: RPC_URL');
  }

  const { tokenAddress } = parseArguments();
  const targetAddress = tokenAddress || process.env.TOKEN_ADDRESS;

  if (!targetAddress) {
    throw new Error(
      'No token address provided. Pass --token <address> or set TOKEN_ADDRESS in .env',
    );
  }

  if (!ethers.isAddress(targetAddress)) {
    throw new Error(`Invalid token address: ${targetAddress}`);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  console.log(`Fetching token metadata for: ${targetAddress}\n`);

  const { name, symbol, decimals } = await fetchTokenMetadata(
    targetAddress,
    provider,
  );

  console.log(`=== Token: ${name} (${symbol}) ===`);
  console.log('Address:', targetAddress);
  console.log('Name:', name);
  console.log('Symbol:', symbol);
  console.log('Decimals:', decimals);
  console.log('===============');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Error:', error.message);
    process.exit(1);
  });
