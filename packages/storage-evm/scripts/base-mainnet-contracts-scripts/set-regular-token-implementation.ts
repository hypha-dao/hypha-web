import dotenv from 'dotenv';
import { ethers, Contract, BaseContractMethod } from 'ethers';

dotenv.config();

interface RegularTokenFactoryInterface extends Contract {
  setSpaceTokenImplementation: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  spaceTokenImplementation: BaseContractMethod<[], string, string>;
}

const REGULAR_TOKEN_FACTORY_ADDRESS =
  '0x95A33EC94de2189893884DaD63eAa19f7390144a'; // RegularTokenFactory Proxy

const NEW_IMPLEMENTATION_ADDRESS = '0x9e536e14EA59c955d37fBae65ed0965de225880b'; // RegularSpaceToken Implementation

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
];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('=== Setting Regular Token Implementation ===\n');
  console.log('Wallet address:', wallet.address);
  console.log('Factory address:', REGULAR_TOKEN_FACTORY_ADDRESS);
  console.log('New implementation:', NEW_IMPLEMENTATION_ADDRESS);
  console.log('');

  const regularTokenFactory = new ethers.Contract(
    REGULAR_TOKEN_FACTORY_ADDRESS,
    regularTokenFactoryAbi,
    wallet,
  ) as unknown as RegularTokenFactoryInterface;

  const currentImplementationAddress =
    await regularTokenFactory.spaceTokenImplementation();

  console.log('Current implementation:', currentImplementationAddress);

  if (
    currentImplementationAddress.toLowerCase() ===
    NEW_IMPLEMENTATION_ADDRESS.toLowerCase()
  ) {
    console.log(
      '✅ Factory is already configured with the regular token implementation.',
    );
  } else {
    console.log('Updating regular token implementation...');
    const tx = await regularTokenFactory.setSpaceTokenImplementation(
      NEW_IMPLEMENTATION_ADDRESS,
    );
    console.log('Transaction hash:', tx.hash);
    await tx.wait();
    console.log('✅ Regular token implementation updated successfully.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
