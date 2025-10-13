import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const OWNERSHIP_TOKEN_FACTORY_ADDRESS =
  '0xc69cB3D966e0Eb5306035e9a27979507D1F334Ee';
const SPACES_CONTRACT_ADDRESS = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

const ownershipTokenFactoryAbi = [
  {
    inputs: [],
    name: 'spacesContract',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'ownershipTokenImplementation',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const spacesContractAbi = [
  {
    inputs: [{ internalType: 'uint256', name: 'spaceId', type: 'uint256' }],
    name: 'getSpaceExecutor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('=== Ownership Token Factory Configuration ===\n');
  console.log('Your wallet address:', wallet.address);
  console.log('Factory address:', OWNERSHIP_TOKEN_FACTORY_ADDRESS);
  console.log('');

  const factory = new ethers.Contract(
    OWNERSHIP_TOKEN_FACTORY_ADDRESS,
    ownershipTokenFactoryAbi,
    provider,
  );

  // Check spaces contract
  const spacesContract = await factory.spacesContract();
  console.log('Configured spaces contract:', spacesContract);
  console.log(
    'Expected spaces contract:',
    SPACES_CONTRACT_ADDRESS,
    spacesContract.toLowerCase() === SPACES_CONTRACT_ADDRESS.toLowerCase()
      ? '✅'
      : '❌',
  );
  console.log('');

  // Check implementation
  const implementation = await factory.ownershipTokenImplementation();
  console.log('Configured implementation:', implementation);
  console.log(
    'Implementation is set:',
    implementation !== ethers.ZeroAddress ? '✅' : '❌',
  );
  console.log('');

  // Check space ID 1 executor
  if (spacesContract !== ethers.ZeroAddress) {
    const spaces = new ethers.Contract(
      spacesContract,
      spacesContractAbi,
      provider,
    );

    try {
      const spaceId = 1;
      const executor = await spaces.getSpaceExecutor(spaceId);
      console.log(`Space ID ${spaceId} executor:`, executor);
      console.log(
        'Your address is the executor:',
        wallet.address.toLowerCase() === executor.toLowerCase() ? '✅' : '❌',
      );
      console.log('');
      console.log(
        '⚠️  IMPORTANT: To deploy ownership tokens, you must call deployOwnershipToken',
      );
      console.log(
        '   from the space executor contract, not from a regular wallet address.',
      );
      console.log('   Your wallet address:', wallet.address);
      console.log('   Required executor address:', executor);
    } catch (error: any) {
      console.error('Error checking space executor:', error.message);
    }
  } else {
    console.log('❌ Spaces contract is not configured!');
    console.log('Run configure-ownership-token-factory.ts first.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
