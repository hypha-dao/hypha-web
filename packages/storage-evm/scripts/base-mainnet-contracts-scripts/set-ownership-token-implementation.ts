import dotenv from 'dotenv';
import { ethers, Contract, BaseContractMethod } from 'ethers';

dotenv.config();

interface OwnershipTokenFactoryInterface extends Contract {
  setOwnershipTokenImplementation: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  ownershipTokenImplementation: BaseContractMethod<[], string, string>;
}

const OWNERSHIP_TOKEN_FACTORY_ADDRESS =
  '0xA1eDf096B72226ae2f7BDEb12E9c9C82152BccB6'; // OwnershipTokenFactory Proxy

const NEW_IMPLEMENTATION_ADDRESS = '0xcD905c80A6d1c1BD4B0996dc33Eb39E9340d1886'; // OwnershipSpaceToken Implementation

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
];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('=== Setting Ownership Token Implementation ===\n');
  console.log('Wallet address:', wallet.address);
  console.log('Factory address:', OWNERSHIP_TOKEN_FACTORY_ADDRESS);
  console.log('New implementation:', NEW_IMPLEMENTATION_ADDRESS);
  console.log('');

  const ownershipTokenFactory = new ethers.Contract(
    OWNERSHIP_TOKEN_FACTORY_ADDRESS,
    ownershipTokenFactoryAbi,
    wallet,
  ) as unknown as OwnershipTokenFactoryInterface;

  const currentImplementationAddress =
    await ownershipTokenFactory.ownershipTokenImplementation();

  console.log('Current implementation:', currentImplementationAddress);

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
    console.log('Transaction hash:', tx.hash);
    await tx.wait();
    console.log('✅ Ownership token implementation updated successfully.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
