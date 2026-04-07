import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

// Complete ABI with all necessary functions
const hyphaTokenAbi = [
  'function totalSupply() view returns (uint256)',
  'function totalMinted() view returns (uint256)',
  'function pendingDistribution() view returns (uint256)',
  'function emergencyResetTotalMinted(uint256 newTotalMinted)',
  'function emergencyResetPendingDistribution()',
  'function emergencyClearPendingRewards(address[] addresses)',
  'function emergencyResetDistributionState(uint256 newTotalMinted, address[] addressesToClear)',
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

  const cleanPrivateKey = privateKey.startsWith('0x')
    ? privateKey
    : `0x${privateKey}`;
  const wallet = new ethers.Wallet(cleanPrivateKey, provider);
  console.log(`Using wallet address: ${wallet.address}\n`);

  const hyphaToken = new ethers.Contract(
    hyphaTokenAddress,
    hyphaTokenAbi,
    wallet,
  );

  // Addresses from the image that have pending rewards (need to be cleared)
  const addressesToClear = [
    '0x8d0e07cb0c966dca466fba84a49327c2996cdfad',
    '0x177a04a0f8f876ad610079a6f7b588fa2cffa325',
    '0x6bed9720fd53b3764e93dd0753c95674cd9b82ce',
    '0x02bb278d4300919f82318db9f54067df636ff98f',
    '0x822bf2fd502d7eaa679bdce365cb620a05924e2c',
    '0x9f3900c6bad5a52cc3210dd2f65062141c88de2f',
    '0x22a4b7a02209958d1cf38d524cb27b9dd59cc36e',
    '0x5a7534ac36bc47b7d4d5fafe87f554f61c3b6f57',
    '0xb7a4c8316ecd34b003fb97b9c1e72fbbaab4dd17',
    '0xe27f33ca8037a2b0f4d3d4f9b8ccd896c2674484',
    '0x34332cb58a4eaae32dd7967e77dc02ae340c3a18',
    '0x36524c09019f7fe2cb2b478acb7607801deacf87',
    '0x5162bcb4e123bcd25d47c73ee3a5de4e9756598a',
    '0xdd55b085f614769af239315d26c3c63ea8b879c4',
    '0x859a4cf3f09f1cbd31207e9567e817906a8f4a44',
    '0xe5c06923632c50a62a7886b8dce2fb818dadb1b0',
    '0x33078d33ee146dd6e516135bbd8a1c33e4ae5d7f',
    '0xbd0297ae3baa6beb07eccb9be5f4837060a0c55e',
    '0x62a9ca1b9b290adf12ddb54c406372ff6eae9e69',
    '0xc63db28a195fe9083b2983ebe86667f77786aebf',
    '0x3b34bb9f25dfe0834498c07848e2797a40790af1',
    '0x65848b5c4c075ddb57fa27e6f2be342bbde9085d',
    '0xe91667b351aeada5b745de94706a9959e8767708',
    '0xc4b6f66130a121725840061e9fee98e6c6c4076',
    '0x695f21b04b22609c4ab9e5886eb0f65cdbd464b6',
    '0x2687fe290b54d824c136ceff2d5bd362bc62019a', // Your address from the list
  ];

  try {
    // Get current state
    console.log('📊 Current Contract State:');
    const totalSupply = await hyphaToken.totalSupply();
    const totalMinted = await hyphaToken.totalMinted();
    const pendingDistribution = await hyphaToken.pendingDistribution();

    console.log(
      `   Total Supply (circulating): ${ethers.formatEther(totalSupply)} HYPHA`,
    );
    console.log(
      `   Total Minted (internal): ${ethers.formatEther(totalMinted)} HYPHA`,
    );
    console.log(
      `   Pending Distribution: ${ethers.formatEther(
        pendingDistribution,
      )} HYPHA`,
    );

    // Check if reset is needed
    if (totalMinted === totalSupply && pendingDistribution === 0n) {
      console.log('\n✅ Contract state is already correct!');
      return;
    }

    console.log('\n🚨 Contract state needs emergency reset!');
    console.log(
      `   Will reset totalMinted from ${ethers.formatEther(
        totalMinted,
      )} to ${ethers.formatEther(totalSupply)}`,
    );
    console.log(
      `   Will reset pendingDistribution from ${ethers.formatEther(
        pendingDistribution,
      )} to 0`,
    );
    console.log(
      `   Will clear pending rewards for ${addressesToClear.length} addresses`,
    );

    console.log('\n⚠️  WARNING: This is an emergency reset that will:');
    console.log('   - Reset totalMinted to match actual circulating supply');
    console.log('   - Clear all pending distribution rewards');
    console.log('   - Clear pending rewards for all affected addresses');
    console.log('   - Allow new investments to work again');

    // Perform the emergency reset using the combined function
    console.log('\n🔄 Executing emergency reset...');

    const tx = await hyphaToken.emergencyResetDistributionState(
      totalSupply,
      addressesToClear,
    );

    console.log(`Transaction sent: ${tx.hash}`);
    console.log('Waiting for confirmation...');

    const receipt = await tx.wait();

    console.log('✅ Emergency reset completed successfully!');
    console.log(`Transaction confirmed in block: ${receipt.blockNumber}`);
    console.log(`Gas used: ${receipt.gasUsed.toString()}`);

    // Verify the reset
    console.log('\n🔍 Verifying reset...');
    const newTotalMinted = await hyphaToken.totalMinted();
    const newPendingDistribution = await hyphaToken.pendingDistribution();
    const newTotalSupply = await hyphaToken.totalSupply();

    console.log(
      `   New Total Minted: ${ethers.formatEther(newTotalMinted)} HYPHA ✅`,
    );
    console.log(
      `   New Pending Distribution: ${ethers.formatEther(
        newPendingDistribution,
      )} HYPHA ✅`,
    );
    console.log(
      `   Total Supply (unchanged): ${ethers.formatEther(
        newTotalSupply,
      )} HYPHA ✅`,
    );
    console.log(
      `   Cleared rewards for: ${addressesToClear.length} addresses ✅`,
    );

    // Calculate new investment capacity
    const maxSupply = ethers.parseEther('555555555'); // MAX_SUPPLY
    const newCapacity = maxSupply - newTotalMinted;

    console.log('\n🎉 Results:');
    console.log(
      `   Investment capacity restored: ${ethers.formatEther(
        newCapacity,
      )} HYPHA`,
    );
    console.log('   ✅ New investments should now work!');
    console.log('   ✅ Contract state matches reality');
    console.log('   ✅ All pending rewards cleared');
  } catch (error: any) {
    console.error('❌ Emergency reset failed:', error.message);

    if (error.message.includes('Ownable: caller is not the owner')) {
      console.log(
        '\n💡 Tip: Only the contract owner can perform emergency resets.',
      );
      console.log("   Make sure you are using the owner's private key.");
    } else if (error.message.includes('Cannot exceed max supply')) {
      console.log(
        '\n💡 Tip: The new totalMinted value would exceed MAX_SUPPLY.',
      );
    } else if (error.message.includes('Cannot be less than current supply')) {
      console.log(
        '\n💡 Tip: The new totalMinted cannot be less than actual circulating supply.',
      );
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
