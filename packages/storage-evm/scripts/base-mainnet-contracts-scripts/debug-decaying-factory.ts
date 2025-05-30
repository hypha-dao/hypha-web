import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const DECAYING_TOKEN_FACTORY = '0x299f4D2327933c1f363301dbd2a28379ccD5539b';

async function main(): Promise<void> {
  if (!process.env.RPC_URL) {
    throw new Error('Missing required environment variable: RPC_URL');
  }

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Try to get the contract code to see if it's deployed
  const code = await provider.getCode(DECAYING_TOKEN_FACTORY);
  console.log('Contract code length:', code.length);

  if (code === '0x') {
    console.log('No contract deployed at this address!');
    return;
  }

  // Try calling with a broader ABI to see what happens
  const testAbi = [
    'function getSpaceToken(uint256) view returns (address)',
    'function spaceTokens(uint256) view returns (address)',
    'function tokens(uint256) view returns (address)',
  ];

  const contract = new ethers.Contract(
    DECAYING_TOKEN_FACTORY,
    testAbi,
    provider,
  );

  // Test different possible function names
  const testFunctions = ['getSpaceToken', 'spaceTokens', 'tokens'];

  for (const funcName of testFunctions) {
    try {
      console.log(`\nTrying function: ${funcName}(94)`);
      const result = await contract[funcName](94);
      console.log(`Result: ${result}`);
    } catch (error: any) {
      console.log(`Failed: ${error.message.split('(')[0]}`);
    }
  }
}

main().catch(console.error);
