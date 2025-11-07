import dotenv from 'dotenv';
import { ethers, Contract, BaseContractMethod } from 'ethers';

dotenv.config();

interface DecayingTokenFactoryInterface extends Contract {
  setDecayingTokenImplementation: BaseContractMethod<
    [string],
    any,
    ethers.ContractTransactionResponse
  >;
  decayingTokenImplementation: BaseContractMethod<[], string, string>;
}

const DECAYING_TOKEN_FACTORY_ADDRESS =
  '0x299f4D2327933c1f363301dbd2a28379ccD5539b'; // DecayingTokenFactory Proxy

const NEW_IMPLEMENTATION_ADDRESS = '0x4c69746B7907f76f6742e2e6e43c5f7Abd4A629B'; // DecayingSpaceToken Implementation

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
];

async function main(): Promise<void> {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  console.log('=== Setting Decaying Token Implementation ===\n');
  console.log('Wallet address:', wallet.address);
  console.log('Factory address:', DECAYING_TOKEN_FACTORY_ADDRESS);
  console.log('New implementation:', NEW_IMPLEMENTATION_ADDRESS);
  console.log('');

  const decayingTokenFactory = new ethers.Contract(
    DECAYING_TOKEN_FACTORY_ADDRESS,
    decayingTokenFactoryAbi,
    wallet,
  ) as unknown as DecayingTokenFactoryInterface;

  const currentImplementationAddress =
    await decayingTokenFactory.decayingTokenImplementation();

  console.log('Current implementation:', currentImplementationAddress);

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
    console.log('Transaction hash:', tx.hash);
    await tx.wait();
    console.log('✅ Decaying token implementation updated successfully.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
