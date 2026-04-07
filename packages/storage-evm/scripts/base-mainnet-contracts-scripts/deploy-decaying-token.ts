import dotenv from 'dotenv';
import {
  ethers,
  EventLog,
  ContractTransactionResponse,
  BaseContract,
  TransactionRequest,
} from 'ethers';

dotenv.config();

interface DecayingTokenFactoryInterface extends BaseContract {
  deployDecayingToken(
    spaceId: ethers.BigNumberish,
    name: string,
    symbol: string,
    maxSupply: ethers.BigNumberish,
    transferable: boolean,
    isVotingToken: boolean,
    decayPercentage: ethers.BigNumberish,
    decayInterval: ethers.BigNumberish,
    overrides?: TransactionRequest,
  ): Promise<ContractTransactionResponse>;
  owner(): Promise<string>;
  decayingTokenImplementation(): Promise<string>;
}

const DECAYING_TOKEN_FACTORY_ADDRESS =
  '0x66CA84bDa7508fa873fc22954b3144064cc5FF37'; // DecayingTokenFactory Proxy

const decayingTokenFactoryAbi = [
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
    name: 'decayingTokenImplementation',
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
      {
        internalType: 'uint256',
        name: 'decayPercentage',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'decayInterval',
        type: 'uint256',
      },
    ],
    name: 'deployDecayingToken',
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
  {
    anonymous: false,
    inputs: [
      {
        indexed: true,
        internalType: 'address',
        name: 'tokenAddress',
        type: 'address',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'decayPercentage',
        type: 'uint256',
      },
      {
        indexed: false,
        internalType: 'uint256',
        name: 'decayInterval',
        type: 'uint256',
      },
    ],
    name: 'DecayingTokenParameters',
    type: 'event',
  },
];

async function main(): Promise<void> {
  // Get command line arguments
  const args = process.argv.slice(2);
  if (args.length !== 8) {
    console.error(
      'Usage: ts-node deploy-decaying-token.ts <spaceId> <name> <symbol> <maxSupply> <transferable> <isVotingToken> <decayPercentage> <decayInterval>',
    );
    console.error(
      'Example: ts-node deploy-decaying-token.ts 1 "My Token" "MTK" 1000000 true false 100 86400',
    );
    console.error(
      'Note: decayPercentage is in basis points (100 = 1%), decayInterval is in seconds',
    );
    process.exit(1);
  }

  const [
    spaceId,
    name,
    symbol,
    maxSupply,
    transferableStr,
    isVotingTokenStr,
    decayPercentage,
    decayInterval,
  ] = args;

  const transferable = transferableStr.toLowerCase() === 'true';
  const isVotingToken = isVotingTokenStr.toLowerCase() === 'true';

  if (
    !DECAYING_TOKEN_FACTORY_ADDRESS ||
    !ethers.isAddress(DECAYING_TOKEN_FACTORY_ADDRESS)
  ) {
    throw new Error(
      `Invalid DecayingTokenFactory address: ${DECAYING_TOKEN_FACTORY_ADDRESS}`,
    );
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log(`Using wallet address: ${wallet.address}`);

  const decayingTokenFactoryAddress = DECAYING_TOKEN_FACTORY_ADDRESS;
  console.log(
    'Using DecayingTokenFactory address:',
    decayingTokenFactoryAddress,
  );

  // Get the DecayingTokenFactory contract instance
  const decayingTokenFactory = new ethers.Contract(
    decayingTokenFactoryAddress,
    decayingTokenFactoryAbi,
    wallet,
  ) as unknown as DecayingTokenFactoryInterface;

  const implementationAddress =
    await decayingTokenFactory.decayingTokenImplementation();
  console.log(
    'Using DecayingSpaceToken implementation address:',
    implementationAddress,
  );

  if (implementationAddress === ethers.ZeroAddress) {
    console.error(
      'Error: DecayingSpaceToken implementation address is not set on the factory.',
    );
    process.exit(1);
  }

  const implementationCode = await provider.getCode(implementationAddress);
  if (implementationCode === '0x') {
    console.error(
      'Error: DecayingSpaceToken implementation address has no code. It might not have been deployed correctly.',
    );
    process.exit(1);
  }

  console.log('Deploying new decaying space token with parameters:');
  console.log('Space ID:', spaceId);
  console.log('Name:', name);
  console.log('Symbol:', symbol);
  console.log('Max Supply:', maxSupply);
  console.log('Transferable:', transferable);
  console.log('Is Voting Token:', isVotingToken);
  console.log('Decay Percentage (basis points):', decayPercentage);
  console.log('Decay Interval (seconds):', decayInterval);

  try {
    const tx = await decayingTokenFactory.deployDecayingToken(
      spaceId,
      name,
      symbol,
      maxSupply,
      transferable,
      isVotingToken,
      decayPercentage,
      decayInterval,
      {
        gasLimit: 2000000, // Increased gas limit for decaying token
      },
    );

    console.log('Transaction sent, waiting for confirmation...');
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    const tokenDeployedTopic =
      decayingTokenFactory.interface.getEvent('TokenDeployed')?.topicHash;

    if (!tokenDeployedTopic) {
      throw new Error('TokenDeployed event not found in contract ABI.');
    }

    const log = receipt.logs.find((l) => l.topics[0] === tokenDeployedTopic);

    if (log && log.topics[2]) {
      // The address is the second indexed topic.
      const deployedTokenAddress = ethers.getAddress(
        '0x' + log.topics[2].slice(26),
      );
      console.log('✅ Decaying token deployed successfully!');
      console.log('Deployed Token Address:', deployedTokenAddress);
    } else {
      console.error(
        'Could not find TokenDeployed event or its address topic in transaction receipt.',
      );
    }
  } catch (error: any) {
    console.error('Error deploying decaying token:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
