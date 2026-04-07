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
    inputs: [
      { internalType: 'address', name: 'account', type: 'address' },
      { internalType: 'bool', name: 'status', type: 'bool' },
    ],
    name: 'setMintTransferWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

async function main(): Promise<void> {
  const targetAddress = process.argv[2];
  if (!targetAddress) {
    console.log(
      'Usage: npx tsx whitelist-minter.ts <address> [hyphaTokenAddress]',
    );
    process.exit(1);
  }
  if (!ethers.isAddress(targetAddress)) {
    throw new Error(`Invalid address: ${targetAddress}`);
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

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
    wallet,
  );

  // Owner check
  const owner: string = await hyphaToken.owner();
  if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
    throw new Error(
      `Permission denied. Wallet ${wallet.address} is not the contract owner (${owner}).`,
    );
  }

  console.log(
    `Whitelisting ${targetAddress} on HyphaToken ${hyphaTokenAddress}...`,
  );
  const tx = await hyphaToken.setMintTransferWhitelist(targetAddress, true);
  console.log('Tx sent:', tx.hash);
  await tx.wait();
  console.log('Whitelisted successfully.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
