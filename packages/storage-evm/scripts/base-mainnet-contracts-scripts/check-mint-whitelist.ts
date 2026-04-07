import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  const patterns = {
    HyphaToken: /HyphaToken deployed to: (0x[a-fA-F0-9]{40})/,
  } as const;

  for (const [key, pattern] of Object.entries(patterns)) {
    const match = fileContent.match(pattern);
    if (match && match[1]) {
      addresses[key] = match[1];
    }
  }

  return addresses;
}

const hyphaTokenAbi = [
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'isMintTransferWhitelisted',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function main(): Promise<void> {
  const addr = process.argv[2];
  if (!addr) {
    console.log(
      'Usage: npx tsx check-mint-whitelist.ts <address> [hyphaTokenAddress]',
    );
    process.exit(1);
  }
  if (!ethers.isAddress(addr)) {
    throw new Error(`Invalid address: ${addr}`);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  let hyphaTokenAddress = process.argv[3];
  if (hyphaTokenAddress && !ethers.isAddress(hyphaTokenAddress)) {
    throw new Error(`Invalid HyphaToken address: ${hyphaTokenAddress}`);
  }
  if (!hyphaTokenAddress) {
    const addresses = parseAddressesFile();
    hyphaTokenAddress = addresses['HyphaToken'];
  }
  if (!hyphaTokenAddress) {
    throw new Error(
      'HyphaToken address not found. Provide it as the second arg or ensure contracts/addresses.txt contains it.',
    );
  }

  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    provider,
  );
  const isWhitelisted: boolean = await hyphaToken.isMintTransferWhitelisted(
    addr,
  );

  console.log(
    JSON.stringify(
      { address: addr, hyphaToken: hyphaTokenAddress, isWhitelisted },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
