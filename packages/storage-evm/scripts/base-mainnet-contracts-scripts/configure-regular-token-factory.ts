import dotenv from 'dotenv';
import { ethers, Contract, BaseContractMethod } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

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

interface RegularTokenFactoryInterface extends Contract {
  setSpaceTokenImplementation: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  setSpacesContract: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  setVotingPowerContract: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  spaceTokenImplementation: BaseContractMethod<[], string, string>;
}

const REGULAR_TOKEN_FACTORY_ADDRESS =
  '0xD932f1A250db1b15D943967F3Ae2e07c23AC8E36'; // Mainnet Factory

const NEW_IMPLEMENTATION_ADDRESS = '0xe04F6ce97437d6a7eC35160Ba227faB505017E14';

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
        internalType: 'address',
        name: '_spacesContract',
        type: 'address',
      },
    ],
    name: 'setSpacesContract',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'address',
        name: '_votingPowerContract',
        type: 'address',
      },
    ],
    name: 'setVotingPowerContract',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const regularTokenFactory = new ethers.Contract(
    REGULAR_TOKEN_FACTORY_ADDRESS,
    regularTokenFactoryAbi,
    wallet,
  ) as unknown as RegularTokenFactoryInterface;

  const currentImplementationAddress =
    await regularTokenFactory.spaceTokenImplementation();

  console.log(
    'Current implementation address from factory:',
    currentImplementationAddress,
  );
  console.log('New implementation address to set:', NEW_IMPLEMENTATION_ADDRESS);

  if (
    currentImplementationAddress.toLowerCase() ===
    NEW_IMPLEMENTATION_ADDRESS.toLowerCase()
  ) {
    console.log(
      '✅ Factory is already configured with the space token implementation.',
    );
  } else {
    console.log('Updating space token implementation...');
    const tx = await regularTokenFactory.setSpaceTokenImplementation(
      NEW_IMPLEMENTATION_ADDRESS,
    );
    await tx.wait();
    console.log('✅ Space token implementation updated successfully.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
