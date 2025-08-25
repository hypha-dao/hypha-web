import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// DecayingTokenFactory ABI
const decayingTokenFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint256', name: 'maxSupply', type: 'uint256' },
      { internalType: 'bool', name: 'transferable', type: 'bool' },
      { internalType: 'bool', name: 'isVotingToken', type: 'bool' },
      { internalType: 'uint256', name: 'decayPercentage', type: 'uint256' },
      { internalType: 'uint256', name: 'decayInterval', type: 'uint256' },
    ],
    name: 'deployDecayingToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'spacesContract',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

// DAOSpaceFactory ABI
const daoSpaceFactoryAbi = [
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceExecutor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function testTokenParams(tokenParams: any, label: string): Promise<void> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const executorAddress = '0x9F9EE2b528dDbb6D5B94DeA85B2749dD38B66920';
  const decayingTokenFactoryAddress =
    '0x299f4D2327933c1f363301dbd2a28379ccD5539b';

  console.log(`\nToken parameters (${label}):`);
  console.log(`- spaceId: ${tokenParams.spaceId}`);
  console.log(`- name: ${tokenParams.name}`);
  console.log(`- symbol: ${tokenParams.symbol}`);
  console.log(`- maxSupply: ${tokenParams.maxSupply}`);
  console.log(`- transferable: ${tokenParams.transferable}`);
  console.log(`- isVotingToken: ${tokenParams.isVotingToken}`);
  console.log(`- decayPercentage: ${tokenParams.decayPercentage}`);
  console.log(`- decayInterval: ${tokenParams.decayInterval}`);

  // Simulate the call from executor
  const iface = new ethers.Interface(decayingTokenFactoryAbi);
  const encodedCall = iface.encodeFunctionData('deployDecayingToken', [
    tokenParams.spaceId,
    tokenParams.name,
    tokenParams.symbol,
    tokenParams.maxSupply,
    tokenParams.transferable,
    tokenParams.isVotingToken,
    tokenParams.decayPercentage,
    tokenParams.decayInterval,
  ]);

  try {
    const result = await provider.call({
      to: decayingTokenFactoryAddress,
      data: encodedCall,
      from: executorAddress, // Simulate call from executor
    });
    console.log(`✅ ${label}: Simulated call succeeded:`, result);
  } catch (error: any) {
    console.log(
      `❌ ${label}: Simulated call failed:`,
      error.reason || error.message,
    );
    if (error.data) {
      console.log(`${label}: Error data:`, error.data);

      // Try to decode the error
      try {
        const errorInterface = new ethers.Interface(['error Error(string)']);
        const decodedError = errorInterface.parseError(error.data);
        console.log(`${label}: Decoded error:`, decodedError.args[0]);
      } catch (decodeError) {
        console.log(`${label}: Could not decode error data`);
      }
    }
  }
}

async function debugDecayingTokenCall(): Promise<void> {
  console.log('Starting debug of DecayingTokenFactory call...');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log(`Using wallet address: ${wallet.address}`);

  const decayingTokenFactoryAddress =
    '0x299f4D2327933c1f363301dbd2a28379ccD5539b';
  const daoSpaceFactoryAddress = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';
  const spaceId = 273; // From the failed test

  const decayingTokenFactory = new ethers.Contract(
    decayingTokenFactoryAddress,
    decayingTokenFactoryAbi,
    wallet,
  );

  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    provider,
  );

  try {
    // Check if spacesContract is set
    const spacesContract = await decayingTokenFactory.spacesContract();
    console.log(`DecayingTokenFactory spacesContract: ${spacesContract}`);
    console.log(`Expected DAOSpaceFactory address: ${daoSpaceFactoryAddress}`);
    console.log(
      `Addresses match: ${
        spacesContract.toLowerCase() === daoSpaceFactoryAddress.toLowerCase()
      }`,
    );

    // Check space executor
    const spaceExecutor = await daoSpaceFactory.getSpaceExecutor(spaceId);
    console.log(`Space ${spaceId} executor: ${spaceExecutor}`);
    console.log(`Current caller (wallet): ${wallet.address}`);
    console.log(
      `Caller matches executor: ${
        wallet.address.toLowerCase() === spaceExecutor.toLowerCase()
      }`,
    );

    // Test parameters with isVotingToken: true
    const tokenParamsTrue = {
      spaceId: spaceId,
      name: 'Test Decay Token',
      symbol: 'TDT',
      maxSupply: 0,
      transferable: false,
      isVotingToken: true, // This causes the failure
      decayPercentage: 1,
      decayInterval: 604800,
    };

    // Test parameters with isVotingToken: false
    const tokenParamsFalse = {
      spaceId: spaceId,
      name: 'Test Decay Token',
      symbol: 'TDT',
      maxSupply: 0,
      transferable: false,
      isVotingToken: false, // This works
      decayPercentage: 1,
      decayInterval: 604800,
    };

    console.log('\n=== Testing with isVotingToken: true ===');
    await testTokenParams(tokenParamsTrue, 'TRUE');

    console.log('\n=== Testing with isVotingToken: false ===');
    await testTokenParams(tokenParamsFalse, 'FALSE');
  } catch (error) {
    console.error('Error in debug:', error);
  }
}

// Run the debug
debugDecayingTokenCall().catch(console.error);
