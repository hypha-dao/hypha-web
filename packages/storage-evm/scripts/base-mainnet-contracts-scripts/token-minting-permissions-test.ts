import dotenv from 'dotenv';
import { ethers } from 'ethers';
import fs from 'fs';

dotenv.config();

interface SpaceCreationParams {
  unity: number;
  quorum: number;
  votingPowerSource: number;
  exitMethod: number;
  joinMethod: number;
}

// Enhanced type definitions to fix errors
interface Log {
  topics: string[];
  data: string;
  [key: string]: any;
}

interface TransactionReceipt {
  logs: Log[];
  [key: string]: any;
}

interface ContractTransactionWithWait extends ethers.ContractTransaction {
  wait(): Promise<TransactionReceipt>;
}

interface DAOSpaceFactoryInterface {
  createSpace: (
    params: SpaceCreationParams,
  ) => Promise<ContractTransactionWithWait>;
  getSpaceMembers: (spaceId: number) => Promise<string[]>;
  getSpaceExecutor: (spaceId: number) => Promise<string>;
}

interface RegularTokenFactoryInterface {
  deployToken: (
    spaceId: number,
    name: string,
    symbol: string,
    maxSupply: number,
    transferable: boolean,
    isVotingToken: boolean,
  ) => Promise<ContractTransactionWithWait>;
}

interface SpaceTokenInterface {
  mint: (
    to: string,
    amount: ethers.BigNumberish,
  ) => Promise<ContractTransactionWithWait>;
}

interface AccountData {
  privateKey: string;
  address: string;
}

const daoSpaceFactoryAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'uint256', name: 'unity', type: 'uint256' },
          { internalType: 'uint256', name: 'quorum', type: 'uint256' },
          {
            internalType: 'uint256',
            name: 'votingPowerSource',
            type: 'uint256',
          },
          { internalType: 'uint256', name: 'exitMethod', type: 'uint256' },
          { internalType: 'uint256', name: 'joinMethod', type: 'uint256' },
        ],
        internalType:
          'struct DAOSpaceFactoryImplementation.SpaceCreationParams',
        name: 'params',
        type: 'tuple',
      },
    ],
    name: 'createSpace',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceExecutor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'uint256', name: '_spaceId', type: 'uint256' }],
    name: 'getSpaceMembers',
    outputs: [{ internalType: 'address[]', name: '', type: 'address[]' }],
    stateMutability: 'view',
    type: 'function',
  },
];

const regularTokenFactoryAbi = [
  {
    inputs: [
      { internalType: 'uint256', name: 'spaceId', type: 'uint256' },
      { internalType: 'string', name: 'name', type: 'string' },
      { internalType: 'string', name: 'symbol', type: 'string' },
      { internalType: 'uint256', name: 'maxSupply', type: 'uint256' },
      { internalType: 'bool', name: 'transferable', type: 'bool' },
      { internalType: 'bool', name: 'isVotingToken', type: 'bool' },
    ],
    name: 'deployToken',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
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
const spaceTokenAbi = [
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function testTokenMintingPermissions(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  const daoSpaceFactoryAddress =
    process.env.DAO_SPACE_FACTORY_ADDRESS ||
    '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

  const regularTokenFactoryAddress =
    process.env.REGULAR_TOKEN_FACTORY_ADDRESS ||
    '0x95A33EC94de2189893884DaD63eAa19f7390144a';

  const daoSpaceFactory = new ethers.Contract(
    daoSpaceFactoryAddress,
    daoSpaceFactoryAbi,
    provider,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  const regularTokenFactory = new ethers.Contract(
    regularTokenFactoryAddress,
    regularTokenFactoryAbi,
    provider,
  ) as ethers.Contract & RegularTokenFactoryInterface;

  let accountData: AccountData[] = [];

  try {
    const data = fs.readFileSync('accounts.json', 'utf8');
    if (data.trim()) {
      accountData = JSON.parse(data);
    }
  } catch (error) {
    console.log('accounts.json not found or invalid. Using default account.');
  }

  if (accountData.length < 2) {
    if (process.env.PRIVATE_KEY) {
      const wallet1 = new ethers.Wallet(process.env.PRIVATE_KEY);
      accountData.push({
        privateKey: process.env.PRIVATE_KEY,
        address: wallet1.address,
      });
    }
    if (process.env.PRIVATE_KEY_2) {
      const wallet2 = new ethers.Wallet(process.env.PRIVATE_KEY_2);
      accountData.push({
        privateKey: process.env.PRIVATE_KEY_2,
        address: wallet2.address,
      });
    }
  }

  if (accountData.length < 2) {
    console.error(
      'Need at least two accounts for this test. Please create an accounts.json file with two accounts or provide PRIVATE_KEY and PRIVATE_KEY_2 in .env',
    );
    return;
  }

  console.log('Testing token minting permissions...');

  const wallet1 = new ethers.Wallet(accountData[0].privateKey, provider);
  const wallet2 = new ethers.Wallet(accountData[1].privateKey, provider);

  const connectedFactory1 = daoSpaceFactory.connect(
    wallet1,
  ) as ethers.Contract & DAOSpaceFactoryInterface;
  const connectedFactory2 = daoSpaceFactory.connect(
    wallet2,
  ) as ethers.Contract & DAOSpaceFactoryInterface;

  // Step 1: Create two spaces
  console.log('Creating two spaces...');
  const spaceParams: SpaceCreationParams = {
    unity: 51,
    quorum: 51,
    votingPowerSource: 1,
    exitMethod: 2,
    joinMethod: 1,
  };

  const tx1 = await connectedFactory1.createSpace(spaceParams);
  const receipt1 = await tx1.wait();
  const spaceCreatedEvent1 = receipt1?.logs.find(
    (log: any) =>
      log.topics[0] ===
      ethers.id(
        'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
      ),
  );
  const spaceId1 = spaceCreatedEvent1
    ? parseInt(spaceCreatedEvent1.topics[1])
    : -1;
  console.log(`Space 1 created with ID: ${spaceId1}`);
  const executor1 = await daoSpaceFactory.getSpaceExecutor(spaceId1);
  console.log(`Space 1 executor: ${executor1}`);

  const tx2 = await connectedFactory2.createSpace(spaceParams);
  const receipt2 = await tx2.wait();
  const spaceCreatedEvent2 = receipt2?.logs.find(
    (log: any) =>
      log.topics[0] ===
      ethers.id(
        'SpaceCreated(uint256,uint256,uint256,uint256,uint256,uint256,address,address)',
      ),
  );
  const spaceId2 = spaceCreatedEvent2
    ? parseInt(spaceCreatedEvent2.topics[1])
    : -1;
  console.log(`Space 2 created with ID: ${spaceId2}`);
  const executor2 = await daoSpaceFactory.getSpaceExecutor(spaceId2);
  console.log(`Space 2 executor: ${executor2}`);

  // Step 2: Create a token for Space 1
  console.log('Creating token for Space 1...');
  const connectedTokenFactory1 = regularTokenFactory.connect(
    wallet1,
  ) as ethers.Contract & RegularTokenFactoryInterface;
  const deployTx = await connectedTokenFactory1.deployToken(
    spaceId1,
    'Token A',
    'TKNA',
    0,
    true,
    false,
  );
  const deployReceipt = await deployTx.wait();
  const tokenDeployedEvent = deployReceipt.logs.find(
    (log: any) =>
      log.address === regularTokenFactoryAddress &&
      log.topics[0] ===
        ethers.id('TokenDeployed(uint256,address,string,string)'),
  );

  if (!tokenDeployedEvent) {
    throw new Error('TokenDeployed event not found');
  }

  const decodedEvent =
    regularTokenFactory.interface.parseLog(tokenDeployedEvent);
  const tokenAddress1 = decodedEvent.args.tokenAddress;
  console.log(`Token for Space 1 deployed at: ${tokenAddress1}`);

  // Step 3: Attempt to mint Token 1 with Wallet 2 (creator of Space 2)
  console.log('Attempting to mint Token 1 with Wallet 2 (should fail)...');
  const token1Contract = new ethers.Contract(
    tokenAddress1,
    spaceTokenAbi,
    provider,
  ) as ethers.Contract & SpaceTokenInterface;
  const connectedToken1WithWallet2 = token1Contract.connect(
    wallet2,
  ) as ethers.Contract & SpaceTokenInterface;

  try {
    await connectedToken1WithWallet2.mint(
      wallet2.address,
      ethers.parseEther('100'),
    );
    console.error(
      'Verification failed: Minting succeeded but was expected to fail.',
    );
  } catch (error: any) {
    if (error.message.includes('Only executor can call this function')) {
      console.log(
        'Verification successful: Minting failed as expected with correct error message.',
      );
    } else {
      console.error(
        'Verification failed: Minting failed, but with an unexpected error.',
      );
      console.error(error);
    }
  }

  console.log('Token minting permissions test completed.');
}

// Usage
testTokenMintingPermissions().catch(console.error);
