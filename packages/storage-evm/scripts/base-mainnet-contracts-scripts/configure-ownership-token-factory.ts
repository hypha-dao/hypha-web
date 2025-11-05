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

interface OwnershipTokenFactoryInterface extends Contract {
  setOwnershipTokenImplementation: BaseContractMethod<
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
  ownershipTokenImplementation: BaseContractMethod<[], string, string>;
  spacesContract: BaseContractMethod<[], string, string>;
}

const OWNERSHIP_TOKEN_FACTORY_ADDRESS =
  '0xc69cB3D966e0Eb5306035e9a27979507D1F334Ee'; // OwnershipTokenFactory Proxy

const NEW_IMPLEMENTATION_ADDRESS = '0xB06f27e16648F36C529839413f307a87b80d6ca1'; // OwnershipSpaceToken Implementation

const SPACES_CONTRACT_ADDRESS = '0xc8B8454D2F9192FeCAbc2C6F5d88F6434A2a9cd9';

const ownershipTokenFactoryAbi = [
  {
    inputs: [
      {
        internalType: 'address',
        name: '_implementation',
        type: 'address',
      },
    ],
    name: 'setOwnershipTokenImplementation',
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

  const ownershipTokenFactory = new ethers.Contract(
    OWNERSHIP_TOKEN_FACTORY_ADDRESS,
    ownershipTokenFactoryAbi,
    wallet,
  ) as unknown as OwnershipTokenFactoryInterface;

  const currentImplementationAddress =
    await ownershipTokenFactory.ownershipTokenImplementation();
  const currentSpacesContract = await ownershipTokenFactory.spacesContract();

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
      '✅ Factory is already configured with the ownership token implementation.',
    );
  } else {
    console.log('Updating ownership token implementation...');
    const tx = await ownershipTokenFactory.setOwnershipTokenImplementation(
      NEW_IMPLEMENTATION_ADDRESS,
    );
    await tx.wait();
    console.log('✅ Ownership token implementation updated successfully.');
  }

  // Check and update spaces contract address
  if (
    currentSpacesContract.toLowerCase() ===
    SPACES_CONTRACT_ADDRESS.toLowerCase()
  ) {
    console.log('✅ Factory is already configured with the spaces contract.');
  } else {
    console.log('Updating spaces contract...');
    const tx = await ownershipTokenFactory.setSpacesContract(
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
