import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// For this test, let's try to understand what would happen if we could call as the executor
// We'll simulate the call and see what specific error we get

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
];

async function testDirectTokenDeployment(): Promise<void> {
  console.log('Testing direct token deployment simulation...');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const decayingTokenFactoryAddress =
    '0x299f4D2327933c1f363301dbd2a28379ccD5539b';
  const spaceId = 273;
  const executorAddress = '0x9F9EE2b528dDbb6D5B94DeA85B2749dD38B66920';

  const decayingTokenFactory = new ethers.Contract(
    decayingTokenFactoryAddress,
    decayingTokenFactoryAbi,
    wallet,
  );

  const tokenParams = {
    spaceId: spaceId,
    name: 'Test Decay Token',
    symbol: 'TDT',
    maxSupply: ethers.parseUnits('1000000', 18),
    transferable: true,
    isVotingToken: true,
    decayPercentage: 500,
    decayInterval: 86400,
  };

  console.log('\\nTrying to get detailed error by simulating the call...');

  // Let's try to use the contract's interface to encode the call and see what happens
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

  console.log('Encoded call data:', encodedCall);
  console.log('Call data length:', encodedCall.length);

  // Try a low-level call to get more detailed error information
  try {
    const result = await provider.call({
      to: decayingTokenFactoryAddress,
      data: encodedCall,
      from: executorAddress, // Simulate call from executor
    });
    console.log('Simulated call succeeded:', result);
  } catch (error: any) {
    console.log('Simulated call failed:', error.reason || error.message);
    if (error.data) {
      console.log('Error data:', error.data);

      // Try to decode the error
      try {
        const errorInterface = new ethers.Interface(['error Error(string)']);
        const decodedError = errorInterface.parseError(error.data);
        console.log('Decoded error:', decodedError);
      } catch (decodeError) {
        console.log('Could not decode error data');
      }
    }
  }

  // Let's also check what the exact parameters would be for the constructor
  console.log('\\nToken constructor parameters that would be used:');
  console.log('- name:', tokenParams.name);
  console.log('- symbol:', tokenParams.symbol);
  console.log('- executor:', executorAddress);
  console.log('- spaceId:', tokenParams.spaceId);
  console.log('- maxSupply:', ethers.formatUnits(tokenParams.maxSupply, 18));
  console.log('- transferable:', tokenParams.transferable);
  console.log('- decayPercentage:', tokenParams.decayPercentage);
  console.log('- decayInterval:', tokenParams.decayInterval);

  // Let's also check if the issue might be with string encoding
  console.log('\\nString parameter analysis:');
  console.log('- name length:', tokenParams.name.length);
  console.log('- symbol length:', tokenParams.symbol.length);
  console.log(
    '- name UTF-8 bytes:',
    ethers.toUtf8Bytes(tokenParams.name).length,
  );
  console.log(
    '- symbol UTF-8 bytes:',
    ethers.toUtf8Bytes(tokenParams.symbol).length,
  );
}

testDirectTokenDeployment().catch(console.error);
