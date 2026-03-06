import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';

dotenv.config();

// Function to parse addresses from addresses.txt
function parseAddressesFile(): Record<string, string> {
  const addressesPath = path.resolve(
    __dirname,
    '../../contracts/addresses.txt',
  );
  const fileContent = fs.readFileSync(addressesPath, 'utf8');

  const addresses: Record<string, string> = {};

  const patterns = {
    HyphaToken: /HyphaToken deployed to: (0x[a-fA-F0-9]{40})/,
  };

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
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'isMintTransferWhitelisted',
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
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'isNormalTransferWhitelisted',
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
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
    ],
    name: 'balanceOf',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length < 1) {
    console.error(
      'Usage: ts-node check-whitelist-status.ts <address> [address2] [address3] ...',
    );
    console.error('Example: ts-node check-whitelist-status.ts 0x1234...5678');
    console.error(
      '         ts-node check-whitelist-status.ts 0x1234...5678 0xabcd...efgh',
    );
    process.exit(1);
  }

  // Validate all addresses
  for (const addr of args) {
    if (!ethers.isAddress(addr)) {
      throw new Error(`Invalid address: ${addr}`);
    }
  }

  // Parse addresses from file
  const addresses = parseAddressesFile();

  if (!addresses['HyphaToken']) {
    throw new Error('Missing HyphaToken address in addresses.txt');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  const hyphaTokenAddress = addresses['HyphaToken'];
  console.log('HyphaToken address:', hyphaTokenAddress);
  console.log('');

  // Get the HyphaToken contract instance
  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    provider,
  );

  // Check status for each address
  console.log('='.repeat(80));
  console.log('WHITELIST STATUS CHECK');
  console.log('='.repeat(80));

  for (const accountAddress of args) {
    console.log(`\nAddress: ${accountAddress}`);
    console.log('-'.repeat(50));

    try {
      const mintStatus = await hyphaToken.isMintTransferWhitelisted(
        accountAddress,
      );
      const normalStatus = await hyphaToken.isNormalTransferWhitelisted(
        accountAddress,
      );
      const balance = await hyphaToken.balanceOf(accountAddress);

      console.log(
        `  Mint Transfer Whitelisted:   ${mintStatus ? '✅ YES' : '❌ NO'}`,
      );
      console.log(
        `  Normal Transfer Whitelisted: ${normalStatus ? '✅ YES' : '❌ NO'}`,
      );
      console.log(
        `  HYPHA Balance:               ${ethers.formatEther(balance)} HYPHA`,
      );

      // Summary
      if (mintStatus && normalStatus) {
        console.log('  📋 Status: Full whitelist (can mint & transfer)');
      } else if (mintStatus) {
        console.log('  📋 Status: Mint whitelist only (can mint on transfer)');
      } else if (normalStatus) {
        console.log(
          '  📋 Status: Normal whitelist only (can transfer balance)',
        );
      } else {
        console.log('  📋 Status: Not whitelisted (cannot transfer)');
      }
    } catch (error: any) {
      console.log(`  ❌ Error checking status: ${error.message}`);
    }
  }

  console.log('\n' + '='.repeat(80));
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
