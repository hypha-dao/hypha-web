import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface AccountData {
  privateKey: string;
  address: string;
}

// TokenVotingPowerImplementation ABI (complete)
const tokenVotingPowerAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: '_spaceId', type: 'uint256' },
      { internalType: 'address', name: '_tokenAddress', type: 'address' },
    ],
    name: 'setSpaceToken',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_spaceFactory', type: 'address' },
    ],
    name: 'setSpaceFactory',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_tokenFactory', type: 'address' },
    ],
    name: 'setTokenFactory',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'spaceFactory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'tokenFactory',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'owner',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: '_user', type: 'address' },
      { internalType: 'uint256', name: '_sourceSpaceId', type: 'uint256' },
    ],
    name: 'getVotingPower',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'uint256', name: '_sourceSpaceId', type: 'uint256' },
    ],
    name: 'getTotalVotingPower',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    name: 'spaceTokens',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// DAOSpaceFactory ABI (minimal)
const daoSpaceFactoryAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceExecutor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function testTokenVotingPowerContract(): Promise<void> {
  console.log('Testing TokenVotingPowerImplementation contract...');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Load account data
  let accountData: AccountData[] = [];
  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
    }
  } catch (error) {
    console.log(
      'accounts.json not found or invalid. Using environment variables.',
    );
  }

  // If no accounts from JSON, try to use environment variable
  if (accountData.length === 0) {
    const privateKey = process.env.PRIVATE_KEY;

    if (privateKey) {
      console.log('Using private key from environment variable.');
      try {
        const cleanPrivateKey = privateKey.startsWith('0x')
          ? privateKey.slice(2)
          : privateKey;

        const wallet = new ethers.Wallet(cleanPrivateKey);
        accountData = [
          {
            privateKey: cleanPrivateKey,
            address: wallet.address,
          },
        ];
      } catch (error) {
        console.error(
          'Invalid private key format in environment variable:',
          error,
        );
      }
    } else {
      console.error('PRIVATE_KEY not found in environment variables.');
    }
  }

  if (accountData.length === 0) {
    console.error(
      'No accounts found. Please create an accounts.json file or provide a valid PRIVATE_KEY in .env',
    );
    return;
  }

  const wallet = new ethers.Wallet(accountData[0].privateKey, provider);
  console.log(`Using wallet address: ${wallet.address}`);

  // Contract addresses
  const daoSpaceFactoryAddress = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';
  const tokenVotingPowerAddress = '0x3214DE1Eb858799Db626Bd9699e78c2E6E33D2BE';

  // Initialize contracts
  const tokenVotingPower = new ethers.Contract(
    tokenVotingPowerAddress,
    tokenVotingPowerAbi,
    wallet,
  );

  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    wallet,
  );

  console.log('Contract addresses:');
  console.log(`- Token Voting Power: ${tokenVotingPowerAddress}`);
  console.log(`- DAO Space Factory: ${daoSpaceFactoryAddress}`);

  try {
    // Check contract configuration
    console.log('\n=== Checking contract configuration ===');

    const owner = await tokenVotingPower.owner();
    console.log(`Contract owner: ${owner}`);

    const spaceFactory = await tokenVotingPower.spaceFactory();
    console.log(`Configured space factory: ${spaceFactory}`);

    const tokenFactory = await tokenVotingPower.tokenFactory();
    console.log(`Configured token factory: ${tokenFactory}`);

    // Check if space factory is configured
    if (spaceFactory === '0x0000000000000000000000000000000000000000') {
      console.log(
        '❌ Space factory not configured! This needs to be set first.',
      );
      console.log('The owner needs to call setSpaceFactory() first.');
      return;
    } else {
      console.log('✅ Space factory is configured');
    }

    // Test with a known space ID (278 from the error log)
    const testSpaceId = 278;
    console.log(`\n=== Testing with space ID: ${testSpaceId} ===`);

    try {
      const spaceExecutor = await daoSpaceFactory.getSpaceExecutor(testSpaceId);
      console.log(`Space ${testSpaceId} executor: ${spaceExecutor}`);

      // Check if current wallet is the executor
      if (spaceExecutor.toLowerCase() === wallet.address.toLowerCase()) {
        console.log('✅ Current wallet is the space executor');
      } else {
        console.log('❌ Current wallet is NOT the space executor');
        console.log(`Current wallet: ${wallet.address}`);
        console.log(`Space executor: ${spaceExecutor}`);
      }

      // Check if space already has a token set
      try {
        const existingToken = await tokenVotingPower.spaceTokens(testSpaceId);
        if (existingToken === '0x0000000000000000000000000000000000000000') {
          console.log('✅ No token currently set for this space');
        } else {
          console.log(`⚠️  Space already has token set: ${existingToken}`);
        }
      } catch (error) {
        console.log('Error checking existing token:', error.message);
      }
    } catch (error) {
      console.log(
        `Error getting space executor for space ${testSpaceId}:`,
        error.message,
      );
    }

    // Test setSpaceToken function signature
    console.log('\n=== Testing function signature ===');
    const testTokenAddress = '0x1234567890123456789012345678901234567890'; // dummy address

    try {
      // This will fail but should show us the exact error
      const gasEstimate = await tokenVotingPower.setSpaceToken.estimateGas(
        testSpaceId,
        testTokenAddress,
      );
      console.log(`Gas estimate for setSpaceToken: ${gasEstimate}`);
    } catch (error) {
      console.log('Error estimating gas for setSpaceToken:', error.message);

      // Check if it's a permission error (expected) or function not found error
      if (error.message.includes('Only space executor can set space token')) {
        console.log('✅ Function exists but permission denied (expected)');
      } else if (error.message.includes('function does not exist')) {
        console.log('❌ Function does not exist in contract');
      } else {
        console.log('❓ Unknown error - function might exist but other issue');
      }
    }
  } catch (error) {
    console.error('Error in contract testing:', error);
  }
}

// Run the test
testTokenVotingPowerContract().catch(console.error);
