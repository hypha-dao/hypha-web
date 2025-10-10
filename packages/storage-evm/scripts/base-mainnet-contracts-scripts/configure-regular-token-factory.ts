import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Add interface definitions
interface Log {
  topics: string[];
  [key: string]: any;
}

interface TransactionReceipt {
  logs: Log[];
  [key: string]: any;
}

interface ContractTransactionWithWait extends ethers.ContractTransaction {
  wait(): Promise<TransactionReceipt>;
}

interface RegularTokenFactoryInterface {
  setSpaceTokenImplementation: (
    implementation: string,
  ) => Promise<ContractTransactionWithWait>;
  owner(): Promise<string>;
}

const REGULAR_TOKEN_FACTORY_ADDRESS =
  '0x9425c91c19066f6CAC6C25bF934F8861914Ccf2e'; // TODO: REPLACE WITH YOUR FACTORY ADDRESS

const regularTokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_implementation',
        type: 'address',
      },
    ],
    name: 'setSpaceTokenImplementation',
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
];

async function main(): Promise<void> {
  const implementationAddress = '0xDAdFbF2D33A8aB74f86752f2afF25F6323d73B87';

  // Validate address
  if (!ethers.isAddress(implementationAddress)) {
    throw new Error(`Invalid implementation address: ${implementationAddress}`);
  }

  if (
    !REGULAR_TOKEN_FACTORY_ADDRESS ||
    !ethers.isAddress(REGULAR_TOKEN_FACTORY_ADDRESS)
  ) {
    throw new Error(
      `Invalid RegularTokenFactory address: ${REGULAR_TOKEN_FACTORY_ADDRESS}`,
    );
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const regularTokenFactoryAddress = REGULAR_TOKEN_FACTORY_ADDRESS;
  console.log('Using RegularTokenFactory address:', regularTokenFactoryAddress);

  // Get the RegularTokenFactory contract instance
  const regularTokenFactory = new ethers.Contract(
    regularTokenFactoryAddress,
    regularTokenFactoryAbi,
    wallet,
  ) as ethers.Contract & RegularTokenFactoryInterface;

  // Check if the wallet is the owner
  const contractOwner = await regularTokenFactory.owner();
  if (contractOwner.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(
      `Your wallet (${wallet.address}) is not the owner of the RegularTokenFactory contract.`,
    );
    console.error(`The owner is: ${contractOwner}`);
    throw new Error(
      'Permission denied: only the contract owner can call setSpaceTokenImplementation',
    );
  }

  console.log(
    'Setting space token implementation with the following parameters:',
  );
  console.log('Implementation Address:', implementationAddress);

  try {
    const tx = await regularTokenFactory.setSpaceTokenImplementation(
      implementationAddress,
    );

    console.log('Transaction sent, waiting for confirmation...');
    await tx.wait();
    console.log('Space token implementation set successfully!');
  } catch (error: any) {
    console.error('Error setting space token implementation:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
