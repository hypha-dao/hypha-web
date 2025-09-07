import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

const hyphaTokenAbi = [
  {
    inputs: [],
    name: 'distributionMultiplier',
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
        name: 'newMultiplier',
        type: 'uint256',
      },
    ],
    name: 'setDistributionMultiplier',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalMinted',
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
    name: 'MAX_SUPPLY',
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
    // Get current distribution multiplier
    console.log('📊 Current Configuration:');
    const currentMultiplier = await hyphaToken.distributionMultiplier();
    console.log(`   Current Distribution Multiplier: ${currentMultiplier}`);
    console.log(
      `   Current (formatted): ${ethers.formatEther(
        currentMultiplier,
      )} (if it has 18 decimals)`,
    );

    // Check supply status
    const totalMinted = await hyphaToken.totalMinted();
    const maxSupply = await hyphaToken.MAX_SUPPLY();
    console.log(`   Total Minted: ${ethers.formatEther(totalMinted)} HYPHA`);
    console.log(`   Max Supply: ${ethers.formatEther(maxSupply)} HYPHA`);
    console.log(
      `   Remaining: ${ethers.formatEther(maxSupply - totalMinted)} HYPHA`,
    );

    // Target multiplier
    const targetMultiplier = 10n;

    console.log(`\n🎯 Target Configuration:`);
    console.log(`   Target Distribution Multiplier: ${targetMultiplier}`);

    // Check if update is needed
    if (currentMultiplier === targetMultiplier) {
      console.log(
        '\n✅ Distribution multiplier is already set to the correct value!',
      );
      return;
    }

    console.log('\n⚠️  Distribution multiplier needs updating!');
    console.log(`   Current: ${currentMultiplier}`);
    console.log(`   Target: ${targetMultiplier}`);

    console.log('\n🔄 Calling setDistributionMultiplier...');

    // Call setDistributionMultiplier
    const tx = await hyphaToken.setDistributionMultiplier(targetMultiplier);

    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Distribution multiplier updated successfully!');
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Verify the update
    console.log('\n🔍 Verifying update...');
    const newMultiplier = await hyphaToken.distributionMultiplier();
    console.log(`   New Distribution Multiplier: ${newMultiplier} ✅`);

    // Check if this fixes the investment capacity
    const remainingAfterFix = maxSupply - totalMinted;
    console.log('\n💡 Impact Analysis:');
    console.log(
      `   Remaining mintable capacity: ${ethers.formatEther(
        remainingAfterFix,
      )} HYPHA`,
    );

    if (remainingAfterFix > 0n) {
      console.log('   ✅ This should allow new investments to work again!');
      console.log(
        '   ✅ Future space payments will generate reasonable rewards',
      );
    } else {
      console.log(
        '   ⚠️  Total supply is still maxed out from previous config',
      );
      console.log(
        '   ⚠️  May need additional fixes or token burns to restore capacity',
      );
    }
  } catch (error: any) {
    console.error('❌ Operation failed:', error.message);

    if (error.message.includes('Ownable: caller is not the owner')) {
      console.log(
        '\n💡 Tip: Only the contract owner can update the distribution multiplier.',
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
