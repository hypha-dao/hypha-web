import dotenv from 'dotenv';
import {
  ethers,
  EventLog,
  ContractTransactionResponse,
  BaseContract,
  TransactionRequest,
} from 'ethers';

dotenv.config();

interface OwnershipTokenFactoryInterface extends BaseContract {
  deployOwnershipToken(
    spaceId: ethers.BigNumberish,
    name: string,
    symbol: string,
    maxSupply: ethers.BigNumberish,
    isVotingToken: boolean,
    overrides?: TransactionRequest,
  ): Promise<ContractTransactionResponse>;
  owner(): Promise<string>;
  ownershipTokenImplementation(): Promise<string>;
}

const OWNERSHIP_TOKEN_FACTORY_ADDRESS =
  '0xc69cB3D966e0Eb5306035e9a27979507D1F334Ee'; // OwnershipTokenFactory Proxy

const ownershipTokenFactoryAbi = [
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
    name: 'ownershipTokenImplementation',
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
        name: 'isVotingToken',
        type: 'bool',
      },
    ],
    name: 'deployOwnershipToken',
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
  if (args.length !== 5) {
    console.error(
      'Usage: ts-node deploy-ownership-token.ts <spaceId> <name> <symbol> <maxSupply> <isVotingToken>',
    );
    console.error(
      'Example: ts-node deploy-ownership-token.ts 1 "My Token" "MTK" 1000000 false',
    );
    process.exit(1);
  }

  const [spaceId, name, symbol, maxSupply, isVotingTokenStr] = args;

  const isVotingToken = isVotingTokenStr.toLowerCase() === 'true';

  if (
    !OWNERSHIP_TOKEN_FACTORY_ADDRESS ||
    !ethers.isAddress(OWNERSHIP_TOKEN_FACTORY_ADDRESS)
  ) {
    throw new Error(
      `Invalid OwnershipTokenFactory address: ${OWNERSHIP_TOKEN_FACTORY_ADDRESS}`,
    );
  }

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  // Create a wallet instance
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log(`Using wallet address: ${wallet.address}`);

  const ownershipTokenFactoryAddress = OWNERSHIP_TOKEN_FACTORY_ADDRESS;
  console.log(
    'Using OwnershipTokenFactory address:',
    ownershipTokenFactoryAddress,
  );

  // Get the OwnershipTokenFactory contract instance
  const ownershipTokenFactory = new ethers.Contract(
    ownershipTokenFactoryAddress,
    ownershipTokenFactoryAbi,
    wallet,
  ) as unknown as OwnershipTokenFactoryInterface;

  const implementationAddress =
    await ownershipTokenFactory.ownershipTokenImplementation();
  console.log(
    'Using OwnershipSpaceToken implementation address:',
    implementationAddress,
  );

  if (implementationAddress === ethers.ZeroAddress) {
    console.error(
      'Error: OwnershipSpaceToken implementation address is not set on the factory.',
    );
    process.exit(1);
  }

  const implementationCode = await provider.getCode(implementationAddress);
  if (implementationCode === '0x') {
    console.error(
      'Error: OwnershipSpaceToken implementation address has no code. It might not have been deployed correctly.',
    );
    process.exit(1);
  }

  console.log('Deploying new ownership space token with parameters:');
  console.log('Space ID:', spaceId);
  console.log('Name:', name);
  console.log('Symbol:', symbol);
  console.log('Max Supply:', maxSupply);
  console.log('Is Voting Token:', isVotingToken);

  try {
    const tx = await ownershipTokenFactory.deployOwnershipToken(
      spaceId,
      name,
      symbol,
      maxSupply,
      isVotingToken,
      {
        gasLimit: 1500000, // Increased gas limit for ownership token
      },
    );

    console.log('Transaction sent, waiting for confirmation...');
    const receipt = await tx.wait();

    if (!receipt) {
      throw new Error('Transaction receipt is null');
    }

    const tokenDeployedTopic =
      ownershipTokenFactory.interface.getEvent('TokenDeployed')?.topicHash;

    if (!tokenDeployedTopic) {
      throw new Error('TokenDeployed event not found in contract ABI.');
    }

    const log = receipt.logs.find((l) => l.topics[0] === tokenDeployedTopic);

    if (log && log.topics[2]) {
      // The address is the second indexed topic.
      const deployedTokenAddress = ethers.getAddress(
        '0x' + log.topics[2].slice(26),
      );
      console.log('✅ Ownership token deployed successfully!');
      console.log('Deployed Token Address:', deployedTokenAddress);
    } else {
      console.error(
        'Could not find TokenDeployed event or its address topic in transaction receipt.',
      );
    }
  } catch (error: any) {
    console.error('Error deploying ownership token:', error.message);
    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
