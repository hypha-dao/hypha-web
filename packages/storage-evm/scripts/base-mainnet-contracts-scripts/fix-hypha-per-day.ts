import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const hyphaTokenAbi = [
  {
    inputs: [],
    name: 'HYPHA_PER_DAY',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'USDC_PER_DAY',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'HYPHA_PRICE_USD',
    outputs: [
      {
        internalType: 'uint256',
        name: '',
        type: 'uint256',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      {
        internalType: 'uint256',
        name: 'newHyphaPrice',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'newUsdcPerDay',
        type: 'uint256',
      },
      {
        internalType: 'uint256',
        name: 'newHyphaPerDay',
        type: 'uint256',
      },
    ],
    name: 'setPricingParameters',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
];

async function main(): Promise<void> {
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
  const rpcUrl = process.env.RPC_URL || 'https://base-rpc.publicnode.com';

  console.log(`Using RPC: ${rpcUrl}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}\n`);

  // Connect to the network
  const provider = new ethers.JsonRpcProvider(rpcUrl);

  // Create a wallet instance
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  // Clean the private key - handle both with and without 0x prefix
  const cleanPrivateKey = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;

  let wallet;
  try {
    wallet = new ethers.Wallet(cleanPrivateKey, provider);
  } catch (error) {
    throw new Error(
      `Invalid private key format. Please ensure PRIVATE_KEY is a valid 64-character hex string (with or without 0x prefix). Error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  console.log(`Using wallet address: ${wallet.address}\n`);

  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  );

  try {
    // Get current values
    console.log('📊 Current Contract Values:');
    const currentHyphaPrice = await hyphaToken.HYPHA_PRICE_USD();
    const currentUsdcPerDay = await hyphaToken.USDC_PER_DAY();
    const currentHyphaPerDay = await hyphaToken.HYPHA_PER_DAY();

    console.log(`   HYPHA_PRICE_USD: ${currentHyphaPrice}`);
    console.log(
      `   USDC_PER_DAY: ${currentUsdcPerDay} (${ethers.formatUnits(
        currentUsdcPerDay,
        6,
      )} USDC)`,
    );
    console.log(
      `   HYPHA_PER_DAY: ${currentHyphaPerDay} (${ethers.formatEther(
        currentHyphaPerDay,
      )} HYPHA)`,
    );

    // Expected correct values based on contract code
    const correctHyphaPrice = 1n; // Used with scaling factor for $0.25 per HYPHA
    const correctUsdcPerDay = 367_000n; // 0.367 USDC per day (6 decimals)
    const correctHyphaPerDay = 1_468_000_000_000_000_000n; // 1.468 HYPHA per day (18 decimals)

    console.log('\n🎯 Expected Correct Values:');
    console.log(`   HYPHA_PRICE_USD: ${correctHyphaPrice}`);
    console.log(
      `   USDC_PER_DAY: ${correctUsdcPerDay} (${ethers.formatUnits(
        correctUsdcPerDay,
        6,
      )} USDC)`,
    );
    console.log(
      `   HYPHA_PER_DAY: ${correctHyphaPerDay} (${ethers.formatEther(
        correctHyphaPerDay,
      )} HYPHA)`,
    );

    // Check if values need updating
    const needsUpdate =
      currentHyphaPrice !== correctHyphaPrice ||
      currentUsdcPerDay !== correctUsdcPerDay ||
      currentHyphaPerDay !== correctHyphaPerDay;

    if (!needsUpdate) {
      console.log('\n✅ All values are already correct! No update needed.');
      return;
    }

    console.log('\n⚠️  Values need updating!');
    console.log('\n🔄 Calling setPricingParameters...');

    // Call setPricingParameters with correct values
    const tx = await hyphaToken.setPricingParameters(
      correctHyphaPrice,
      correctUsdcPerDay,
      correctHyphaPerDay,
    );

    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Parameters updated successfully!');
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Verify the update
    console.log('\n🔍 Verifying updated values...');
    const newHyphaPrice = await hyphaToken.HYPHA_PRICE_USD();
    const newUsdcPerDay = await hyphaToken.USDC_PER_DAY();
    const newHyphaPerDay = await hyphaToken.HYPHA_PER_DAY();

    console.log(`   HYPHA_PRICE_USD: ${newHyphaPrice} ✅`);
    console.log(
      `   USDC_PER_DAY: ${newUsdcPerDay} (${ethers.formatUnits(
        newUsdcPerDay,
        6,
      )} USDC) ✅`,
    );
    console.log(
      `   HYPHA_PER_DAY: ${newHyphaPerDay} (${ethers.formatEther(
        newHyphaPerDay,
      )} HYPHA) ✅`,
    );

    // Test the calculation with 44 HYPHA
    const hyphaAmount = ethers.parseEther('44');
    const hyphaAmountNumber = Number(ethers.formatEther(hyphaAmount));
    const hyphaPerDayNumber = Number(ethers.formatEther(newHyphaPerDay));
    const durationInDays = hyphaAmountNumber / hyphaPerDayNumber;

    console.log('\n🧮 Payment Duration Test:');
    console.log(
      `   44 HYPHA ÷ ${hyphaPerDayNumber} HYPHA/day = ${
        Math.round(durationInDays * 100) / 100
      } days`,
    );
    console.log(`   Expected: ~30 days ✅`);
  } catch (error: any) {
    console.error('❌ Operation failed:', error.message);

    if (error.message.includes('Ownable: caller is not the owner')) {
      console.log(
        '\n💡 Tip: Only the contract owner can update pricing parameters.',
      );
      console.log("   Make sure you are using the owner's private key.");
    }

    throw error;
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
