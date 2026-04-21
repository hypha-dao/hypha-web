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
  blockNumber: number;
  [key: string]: any;
}

interface ContractTransactionWithWait extends ethers.ContractTransaction {
  hash: string;
  wait(): Promise<TransactionReceipt>;
}

interface HyphaTokenInterface {
  setNormalTransferWhitelist: (
    account: string,
    status: boolean,
    overrides?: { gasLimit?: number },
  ) => Promise<ContractTransactionWithWait>;
  owner(): Promise<string>;
  isNormalTransferWhitelisted(account: string): Promise<boolean>;
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
        name: 'status',
        type: 'bool',
      },
    ],
    name: 'setNormalTransferWhitelist',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: 'account',
        type: 'address',
      },
      {
        internalType: 'bool',
        name: 'status',
        type: 'bool',
      },
    ],
    name: 'setMintTransferWhitelist',
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
  if (args.length !== 2) {
    console.error(
      'Usage: npm run set-normal-transfer-whitelist <address> <status>',
    );
    console.error(
      'Example: npm run set-normal-transfer-whitelist 0x1234567890123456789012345678901234567890 true',
    );
    process.exit(1);
  }

  const [accountAddress, statusStr] = args;

  // Validate address
  if (!ethers.isAddress(accountAddress)) {
    throw new Error(`Invalid address: ${accountAddress}`);
  }

  // Validate and parse status
  const status = statusStr.toLowerCase() === 'true';
  if (
    statusStr.toLowerCase() !== 'true' &&
    statusStr.toLowerCase() !== 'false'
  ) {
    throw new Error(
      `Invalid status. Must be 'true' or 'false', got: ${statusStr}`,
    );
  }

  // Parse addresses from file
  const addresses = parseAddressesFile();

  // Verify HyphaToken address is available
  if (!addresses['HyphaToken']) {
    throw new Error('Missing HyphaToken address in addresses.txt');
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const hyphaTokenAddress = addresses['HyphaToken'];
  console.log('HyphaToken address from addresses.txt:', hyphaTokenAddress);
  console.log('Your wallet address:', wallet.address);

  // Get the HyphaToken contract instance
  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  ) as ethers.Contract & HyphaTokenInterface;

  // Check if the wallet is the owner
  const contractOwner = await hyphaToken.owner();
  console.log('Contract owner:', contractOwner);
  console.log(
    'Ownership check:',
    contractOwner.toLowerCase() === wallet.address.toLowerCase()
      ? 'PASSED'
      : 'FAILED',
  );

  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the HyphaToken contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setNormalTransferWhitelist',
    );
  }

  // Diagnostic: Check which functions exist on the contract
  console.log('\n--- Function Availability Check ---');

  // Test isNormalTransferWhitelisted (view)
  try {
    const normalStatus = await (
      hyphaToken as ethers.Contract
    ).isNormalTransferWhitelisted(accountAddress);
    console.log(
      '✅ isNormalTransferWhitelisted exists, returns:',
      normalStatus,
    );
  } catch (e: any) {
    console.log(
      '❌ isNormalTransferWhitelisted FAILED:',
      e.message?.slice(0, 50),
    );
  }

  // Test isMintTransferWhitelisted (view)
  try {
    const mintStatus = await (
      hyphaToken as ethers.Contract
    ).isMintTransferWhitelisted(accountAddress);
    console.log('✅ isMintTransferWhitelisted exists, returns:', mintStatus);
  } catch (e: any) {
    console.log(
      '❌ isMintTransferWhitelisted FAILED:',
      e.message?.slice(0, 50),
    );
  }

  // Test setMintTransferWhitelist (write - static call)
  try {
    await (hyphaToken as ethers.Contract).setMintTransferWhitelist.staticCall(
      accountAddress,
      status,
    );
    console.log('✅ setMintTransferWhitelist exists (static call succeeded)');
  } catch (e: any) {
    console.log('❌ setMintTransferWhitelist FAILED:', e.message?.slice(0, 80));
  }

  // Test setNormalTransferWhitelist (write - static call)
  try {
    await (hyphaToken as ethers.Contract).setNormalTransferWhitelist.staticCall(
      accountAddress,
      status,
    );
    console.log('✅ setNormalTransferWhitelist exists (static call succeeded)');
  } catch (e: any) {
    console.log(
      '❌ setNormalTransferWhitelist FAILED:',
      e.message?.slice(0, 80),
    );
  }

  console.log('--- End Function Check ---\n');

  // Check current whitelist status
  let currentStatus = false;
  try {
    currentStatus = await hyphaToken.isNormalTransferWhitelisted(
      accountAddress,
    );
    console.log(
      'Current whitelist status for',
      accountAddress + ':',
      currentStatus,
    );
  } catch (e) {
    console.log('Could not check current status (function may not exist)');
  }

  if (currentStatus === status) {
    console.log(
      `Address is already ${
        status ? 'whitelisted' : 'not whitelisted'
      }. No action needed.`,
    );
    return;
  }

  console.log(
    '\nSetting normal transfer whitelist with the following parameters:',
  );
  console.log('Account:', accountAddress);
  console.log('Status:', status);

  try {
    console.log('\nSending transaction with manual gas limit...');
    const tx = await hyphaToken.setNormalTransferWhitelist(
      accountAddress,
      status,
      { gasLimit: 100000 }, // Manual gas limit to bypass estimation
    );

    console.log('Transaction hash:', tx.hash);
    console.log('Waiting for confirmation...');
    const receipt = await tx.wait();
    console.log('Transaction confirmed in block:', receipt.blockNumber);
    console.log('Normal transfer whitelist set successfully!');
  } catch (error: any) {
    console.error('\nError setting normal transfer whitelist:', error.message);
    if (error.reason) {
      console.error('Reason:', error.reason);
    }
    if (error.code) {
      console.error('Error code:', error.code);
    }
    console.error(
      '\n⚠️  If setMintTransferWhitelist works but setNormalTransferWhitelist fails,',
    );
    console.error(
      '   you need to upgrade the HyphaToken contract implementation.',
    );
    console.error(
      '   Run: npx hardhat run scripts/hypha-token.upgrade.ts --network base',
    );
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
