import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Executor ABI
const executorAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'address', name: 'target', type: 'address' },
          { internalType: 'uint256', name: 'value', type: 'uint256' },
          { internalType: 'bytes', name: 'data', type: 'bytes' },
        ],
        internalType: 'struct IExecutor.Transaction[]',
        name: 'transactions',
        type: 'tuple[]',
      },
    ],
    name: 'executeTransactions',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function debugExecutorCall(): Promise<void> {
  console.log('Starting debug of Executor call to DecayingTokenFactory...');

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log(`Using wallet address: ${wallet.address}`);

  const executorAddress = '0x9F9EE2b528dDbb6D5B94DeA85B2749dD38B66920'; // Space 273 executor
  const decayingTokenFactoryAddress =
    '0x299f4D2327933c1f363301dbd2a28379ccD5539b';
  const spaceId = 273;

  const executor = new ethers.Contract(executorAddress, executorAbi, wallet);

  // Prepare the same transaction data as in the original script
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

  console.log('\nPreparing transaction data...');

  // Encode the deployDecayingToken function call exactly like the original script
  const deployTokenData = ethers.AbiCoder.defaultAbiCoder().encode(
    [
      'uint256',
      'string',
      'string',
      'uint256',
      'bool',
      'bool',
      'uint256',
      'uint256',
    ],
    [
      tokenParams.spaceId,
      tokenParams.name,
      tokenParams.symbol,
      tokenParams.maxSupply,
      tokenParams.transferable,
      tokenParams.isVotingToken,
      tokenParams.decayPercentage,
      tokenParams.decayInterval,
    ],
  );

  const deployTokenMethod =
    'deployDecayingToken(uint256,string,string,uint256,bool,bool,uint256,uint256)';
  const deployTokenFunctionSelector = ethers
    .id(deployTokenMethod)
    .substring(0, 10);
  const encodedDeployTokenData =
    deployTokenFunctionSelector + deployTokenData.substring(2);

  console.log(`Function selector: ${deployTokenFunctionSelector}`);
  console.log(`Encoded data length: ${encodedDeployTokenData.length}`);
  console.log(`Encoded data: ${encodedDeployTokenData.substring(0, 100)}...`);

  const transaction = {
    target: decayingTokenFactoryAddress,
    value: 0,
    data: encodedDeployTokenData,
  };

  console.log('\nTransaction details:');
  console.log(`- Target: ${transaction.target}`);
  console.log(`- Value: ${transaction.value}`);
  console.log(`- Data length: ${transaction.data.length}`);

  // Try to call executeTransactions
  console.log('\n=== Testing executeTransactions call ===');
  console.log('Note: This should fail because we are not the proposal manager');

  try {
    const txResponse = await executor.executeTransactions([transaction], {
      gasLimit: 3000000,
    });
    console.log(`Execute transactions succeeded: ${txResponse.hash}`);

    const receipt = await txResponse.wait();
    console.log(`Transaction confirmed with status: ${receipt?.status}`);
  } catch (error: any) {
    console.log(
      `Execute transactions failed: ${error.reason || error.message}`,
    );

    // Try to get more detailed error info
    if (error.data) {
      console.log(`Error data: ${error.data}`);
    }

    // Try gas estimation to see the real error
    try {
      console.log('\n=== Testing gas estimation for executeTransactions ===');
      const gasEstimate = await executor.executeTransactions.estimateGas([
        transaction,
      ]);
      console.log(`Gas estimate: ${gasEstimate}`);
    } catch (gasError: any) {
      console.log(
        `Gas estimation failed: ${gasError.reason || gasError.message}`,
      );
      if (gasError.data) {
        console.log(`Gas error data: ${gasError.data}`);
      }
    }
  }

  // Let's also test what happens if we impersonate the executor
  console.log('\n=== Testing with impersonated executor (for debugging) ===');
  console.log('This would require a local fork to work properly...');

  // For now, let's just show what the call would look like
  console.log(
    `If we were the executor (${executorAddress}), the call would be:`,
  );
  console.log(`- msg.sender: ${executorAddress}`);
  console.log(`- target: ${decayingTokenFactoryAddress}`);
  console.log(`- function: deployDecayingToken(...)`);
  console.log(`- spaceId: ${tokenParams.spaceId}`);
}

// Run the debug
debugExecutorCall().catch(console.error);
