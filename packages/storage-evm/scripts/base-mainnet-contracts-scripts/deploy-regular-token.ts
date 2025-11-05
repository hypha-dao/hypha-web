import dotenv from 'dotenv';
import {
  ethers,
  EventLog,
  ContractTransactionResponse,
  BaseContract,
  TransactionRequest,
} from 'ethers';

dotenv.config();

interface RegularTokenFactoryInterface extends BaseContract {
  deployToken(
    spaceId: ethers.BigNumberish,
    name: string,
    symbol: string,
    maxSupply: ethers.BigNumberish,
    transferable: boolean,
    isVotingToken: boolean,
    overrides?: TransactionRequest,
  ): Promise<ContractTransactionResponse>;
  owner(): Promise<string>;
  spaceTokenImplementation(): Promise<string>;
}

const REGULAR_TOKEN_FACTORY_ADDRESS =
  '0xD932f1A250db1b15D943967F3Ae2e07c23AC8E36'; // Mainnet Factory

const regularTokenFactoryAbi = [
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
    inputs: [],
    name: 'spaceTokenImplementation',
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
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
      {
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
      {
        internalType: 'string',
        name: 'symbol',
        type: 'string',
      },
      {
        internalType: 'uint256',
        name: 'maxSupply',
        type: 'uint256',
      },
      {
        internalType: 'bool',
        name: 'transferable',
        type: 'bool',
      },
      {
        internalType: 'bool',
        name: 'isVotingToken',
        type: 'bool',
      },
    ],
    name: 'deployToken',
    outputs: [
      {
        internalType: 'address',
        name: '',
        type: 'address',
      },
    ],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'uint256',
        name: 'spaceId',
        type: 'uint256',
      },
      {
        indexed: true,
        internalType: 'address',
        name: 'tokenAddress',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'name',
        type: 'string',
      },
      {
        indexed: false,
        internalType: 'string',
        name: 'symbol',
        type: 'string',
      },
    ],
    name: 'TokenDeployed',
    type: 'event',
  },
];

async function main(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 6) {
    console.error(
      'Usage: ts-node deploy-regular-token.ts <spaceId> <name> <symbol> <maxSupply> <transferable> <isVotingToken>',
    );
    console.error(
      'Example: ts-node deploy-regular-token.ts 1 "My Token" "MTK" 1000000 true false',
    );
    process.exit(1);
  }

  const [spaceId, name, symbol, maxSupply, transferableStr, isVotingTokenStr] =
    args;

  const transferable = transferableStr.toLowerCase() === 'true';
  const isVotingToken = isVotingTokenStr.toLowerCase() === 'true';

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

  console.log(`Using wallet address: ${wallet.address}`);

  const regularTokenFactoryAddress = REGULAR_TOKEN_FACTORY_ADDRESS;
  console.log('Using RegularTokenFactory address:', regularTokenFactoryAddress);

  // Get the RegularTokenFactory contract instance
  const regularTokenFactory = new ethers.Contract(
    regularTokenFactoryAddress,
    regularTokenFactoryAbi,
    wallet,
  ) as unknown as RegularTokenFactoryInterface;

  const implementationAddress =
    await regularTokenFactory.spaceTokenImplementation();
  console.log(
    'Using SpaceToken implementation address:',
    implementationAddress,
  );

  if (implementationAddress === ethers.ZeroAddress) {
    console.error(
      'Error: SpaceToken implementation address is not set on the factory.',
    );
    process.exit(1);
  }

  const implementationCode = await provider.getCode(implementationAddress);
  if (implementationCode === '0x') {
    console.error(
      'Error: SpaceToken implementation address has no code. It might not have been deployed correctly.',
    );
    process.exit(1);
  }

  console.log('Deploying new regular space token with parameters:');
  console.log('Space ID:', spaceId);
  console.log('Name:', name);
  console.log('Symbol:', symbol);
  console.log('Max Supply:', maxSupply);
  console.log('Transferable:', transferable);
  console.log('Is Voting Token:', isVotingToken);

  try {
    const tx = await regularTokenFactory.deployToken(
      spaceId,
      name,
      symbol,
      maxSupply,
      transferable,
      isVotingToken,
      {
        gasLimit: 1000000, // Manually set gas limit
      },
    );

    console.log('Transaction sent, waiting for confirmation...');
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    const tokenDeployedTopic =
      regularTokenFactory.interface.getEvent('TokenDeployed')?.topicHash;

    if (!tokenDeployedTopic) {
      throw new Error('TokenDeployed event not found in contract ABI.');
    }

    const log = receipt.logs.find((l) => l.topics[0] === tokenDeployedTopic);

    if (log && log.topics[2]) {
      // The address is the second indexed topic.
      const deployedTokenAddress = ethers.getAddress(
        '0x' + log.topics[2].slice(26),
      );
      console.log('✅ Token deployed successfully!');
      console.log('Deployed Token Address:', deployedTokenAddress);
    } else {
      console.error(
        'Could not find TokenDeployed event or its address topic in transaction receipt.',
      );
    }
  } catch (error: any) {
    console.error('Error deploying token:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
