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
      {
        internalType: 'bool',
        name: 'mintTransferStatus',
        type: 'bool',
      },
      {
        internalType: 'bool',
        name: 'normalTransferStatus',
        type: 'bool',
      },
    ],
    name: 'setWhitelistStatus',
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
];

async function main(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 3) {
    console.error(
      'Usage: ts-node set-whitelist-status.ts <address> <mintTransferStatus> <normalTransferStatus>',
    );
    console.error(
      'Example: ts-node set-whitelist-status.ts 0x1234...5678 true true',
    );
    console.error(
      '         ts-node set-whitelist-status.ts 0x1234...5678 false true',
    );
    process.exit(1);
  }

  const [accountAddress, mintStatusStr, normalStatusStr] = args;

  // Validate address
  if (!ethers.isAddress(accountAddress)) {
    throw new Error(`Invalid address: ${accountAddress}`);
  }

  // Validate and parse statuses
  const mintTransferStatus = mintStatusStr.toLowerCase() === 'true';
  const normalTransferStatus = normalStatusStr.toLowerCase() === 'true';

  if (
    mintStatusStr.toLowerCase() !== 'true' &&
    mintStatusStr.toLowerCase() !== 'false'
  ) {
    throw new Error(
      `Invalid mintTransferStatus. Must be 'true' or 'false', got: ${mintStatusStr}`,
    );
  }

  if (
    normalStatusStr.toLowerCase() !== 'true' &&
    normalStatusStr.toLowerCase() !== 'false'
  ) {
    throw new Error(
      `Invalid normalTransferStatus. Must be 'true' or 'false', got: ${normalStatusStr}`,
    );
  }

  // Parse addresses from file
  const addresses = parseAddressesFile();

  if (!addresses['HyphaToken']) {
    throw new Error('Missing HyphaToken address in addresses.txt');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const hyphaTokenAddress = addresses['HyphaToken'];
  console.log('HyphaToken address:', hyphaTokenAddress);
  console.log('Your wallet address:', wallet.address);

  // Get the HyphaToken contract instance
  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  );

  // Check if the wallet is the owner
  const contractOwner = await hyphaToken.owner();
  console.log('Contract owner:', contractOwner);

  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the HyphaToken contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setWhitelistStatus',
    );
  }

  console.log('Ownership check: PASSED\n');

  // Check current whitelist status
  try {
    const currentMintStatus = await hyphaToken.isMintTransferWhitelisted(
      accountAddress,
    );
    const currentNormalStatus = await hyphaToken.isNormalTransferWhitelisted(
      accountAddress,
    );
    console.log('Current status for', accountAddress + ':');
    console.log('  Mint transfer whitelist:', currentMintStatus);
    console.log('  Normal transfer whitelist:', currentNormalStatus);
  } catch (e) {
    console.log('Could not check current status');
  }

  console.log('\nSetting whitelist status with the following parameters:');
  console.log('  Account:', accountAddress);
  console.log('  Mint transfer status:', mintTransferStatus);
  console.log('  Normal transfer status:', normalTransferStatus);

  try {
    console.log('\nSending transaction...');
    const tx = await hyphaToken.setWhitelistStatus(
      accountAddress,
      mintTransferStatus,
      normalTransferStatus,
      { gasLimit: 100000 },
    );

    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    console.log('\n✅ Whitelist status set successfully!');

    // Verify the new status
    const newMintStatus = await hyphaToken.isMintTransferWhitelisted(
      accountAddress,
    );
    const newNormalStatus = await hyphaToken.isNormalTransferWhitelisted(
      accountAddress,
    );
    console.log('\nNew status for', accountAddress + ':');
    console.log('  Mint transfer whitelist:', newMintStatus);
    console.log('  Normal transfer whitelist:', newNormalStatus);
  } catch (error: any) {
    console.error('\nError setting whitelist status:', error.message);
    if (error.reason) {
      console.error('Reason:', error.reason);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
