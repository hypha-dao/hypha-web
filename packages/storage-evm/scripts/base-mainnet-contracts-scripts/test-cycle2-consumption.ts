import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const contractAbi = [
  {
    inputs: [
      {
        components: [
          { internalType: 'uint256', name: 'deviceId', type: 'uint256' },
          { internalType: 'uint256', name: 'quantity', type: 'uint256' },
        ],
        internalType: 'struct IEnergyDistribution.ConsumptionRequest[]',
        name: 'consumptionRequests',
        type: 'tuple[]',
      },
    ],
    name: 'consumeEnergyTokens',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'verifyZeroSumProperty',
    outputs: [
      { internalType: 'bool', name: '', type: 'bool' },
      { internalType: 'int256', name: '', type: 'int256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
];

async function main() {
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY || '', provider);

  const contractAddress = '0x02d88b0C4CC3A4AE86482056c25d65916Dd6DD95';
  const contract = new ethers.Contract(contractAddress, contractAbi, wallet);

  console.log('🧪 Testing Cycle 2 Consumption\n');

  // Check zero-sum before
  const [isZeroSum, balance] = await contract.verifyZeroSumProperty();
  console.log('Zero-sum before:', isZeroSum, 'Balance:', balance.toString());

  const consumptionRequests = [
    { deviceId: 1, quantity: 40 }, // H1
    // H2 doesn't consume (deviceId 2)
    { deviceId: 3, quantity: 76 }, // H3 (44 + 32 from H2)
    { deviceId: 4, quantity: 24 }, // H4
    { deviceId: 5, quantity: 60 }, // H5
  ];

  console.log('\nTrying consumption with explicit gas limit...');
  try {
    const tx = await contract.consumeEnergyTokens(consumptionRequests, {
      gasLimit: 5000000, // 5M gas limit
    });
    console.log('Transaction sent:', tx.hash);
    const receipt = await tx.wait();
    console.log('✅ Success! Gas used:', receipt.gasUsed.toString());
  } catch (error: any) {
    console.error('❌ Failed:', error.message);

    // Try with staticCall to get better error
    console.log('\nTrying staticCall for better error message...');
    try {
      await contract.consumeEnergyTokens.staticCall(consumptionRequests);
    } catch (staticError: any) {
      console.error('Static call error:', staticError.message);
      if (staticError.reason) {
        console.error('Reason:', staticError.reason);
      }
    }
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
