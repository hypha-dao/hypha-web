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

interface DecayingTokenFactoryInterface extends Contract {
  setDecayingTokenImplementation: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  setSpacesContract: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  setDecayVotingPowerContract: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  decayingTokenImplementation: BaseContractMethod<[], string, string>;
  spacesContract: BaseContractMethod<[], string, string>;
}

const DECAYING_TOKEN_FACTORY_ADDRESS =
  '0x66CA84bDa7508fa873fc22954b3144064cc5FF37'; // DecayingTokenFactory Proxy

const NEW_IMPLEMENTATION_ADDRESS = '0x5BE10FdAce191216236668d9cDb12772f73CB698'; // DecayingSpaceToken Implementation

const SPACES_CONTRACT_ADDRESS = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

const decayingTokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_implementation',
        type: 'address',
      },
    ],
    name: 'setDecayingTokenImplementation',
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
        name: '_decayVotingPowerContract',
        type: 'address',
      },
    ],
    name: 'setDecayVotingPowerContract',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'spacesContract',
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
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const decayingTokenFactory = new ethers.Contract(
    DECAYING_TOKEN_FACTORY_ADDRESS,
    decayingTokenFactoryAbi,
    wallet,
  ) as unknown as DecayingTokenFactoryInterface;

  const currentImplementationAddress =
    await decayingTokenFactory.decayingTokenImplementation();
  const currentSpacesContract = await decayingTokenFactory.spacesContract();

  console.log(
    'Current implementation address from factory:',
    currentImplementationAddress,
  );
  console.log('New implementation address to set:', NEW_IMPLEMENTATION_ADDRESS);
  console.log(
    'Current spaces contract address from factory:',
    currentSpacesContract,
  );
  console.log('Spaces contract address to set:', SPACES_CONTRACT_ADDRESS);

  // Check and update implementation address
  if (
    currentImplementationAddress.toLowerCase() ===
    NEW_IMPLEMENTATION_ADDRESS.toLowerCase()
  ) {
    console.log(
      '✅ Factory is already configured with the decaying token implementation.',
    );
  } else {
    console.log('Updating decaying token implementation...');
    const tx = await decayingTokenFactory.setDecayingTokenImplementation(
      NEW_IMPLEMENTATION_ADDRESS,
    );
    await tx.wait();
    console.log('✅ Decaying token implementation updated successfully.');
  }

  // Check and update spaces contract address
  if (
    currentSpacesContract.toLowerCase() ===
    SPACES_CONTRACT_ADDRESS.toLowerCase()
  ) {
    console.log('✅ Factory is already configured with the spaces contract.');
  } else {
    console.log('Updating spaces contract...');
    const tx = await decayingTokenFactory.setSpacesContract(
      SPACES_CONTRACT_ADDRESS,
    );
    await tx.wait();
    console.log('✅ Spaces contract updated successfully.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
