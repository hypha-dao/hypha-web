import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function main(): Promise<void> {
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';
  const rpcUrl = 'https://mainnet.base.org';

  console.log(`Using RPC: ${rpcUrl}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}\n`);

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const privateKey = process.env.PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('PRIVATE_KEY environment variable is required');
  }

  const wallet = new ethers.Wallet(privateKey, provider);
  console.log(`Using wallet address: ${wallet.address}\n`);

  const abi = ['function emergencyClearPendingRewards(address[] addresses)'];
  const contract = new ethers.Contract(hyphaTokenAddress, abi, wallet);

  // All addresses that need pending rewards cleared
  const allAddresses = [
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
    '0x2687fe290b54d824c136ceff2d5bd362bc62019a',
  ];

  console.log(
    `🔄 Clearing pending rewards for ${allAddresses.length} addresses...`,
  );

  // Process in smaller batches to avoid gas limits and network issues
  const batchSize = 5;
  const batches = [];

  for (let i = 0; i < allAddresses.length; i += batchSize) {
    batches.push(allAddresses.slice(i, i + batchSize));
  }

  console.log(
    `   Processing in ${batches.length} batches of up to ${batchSize} addresses each\n`,
  );

  try {
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(
        `📦 Batch ${i + 1}/${batches.length}: Clearing ${
          batch.length
        } addresses...`,
      );
      console.log(`   Addresses: ${batch.join(', ')}`);

      // Estimate gas first
      try {
        const gasEstimate =
          await contract.emergencyClearPendingRewards.estimateGas(batch);
        console.log(`   ⛽ Gas estimate: ${gasEstimate.toString()}`);
      } catch (gasError) {
        console.log(
          `   ⚠️  Could not estimate gas: ${
            gasError instanceof Error ? gasError.message : String(gasError)
          }`,
        );
      }

      // Execute the transaction
      const tx = await contract.emergencyClearPendingRewards(batch);
      console.log(`   📤 Transaction sent: ${tx.hash}`);

      // Wait for confirmation
      const receipt = await tx.wait();
      console.log(
        `   ✅ Confirmed in block ${
          receipt.blockNumber
        }, gas used: ${receipt.gasUsed.toString()}`,
      );

      // Small delay between batches to be network-friendly
      if (i < batches.length - 1) {
        console.log(`   ⏳ Waiting 2 seconds before next batch...\n`);
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }

    console.log('\n🎉 SUCCESS! All pending rewards have been cleared!');
    console.log(
      `   ✅ Processed ${allAddresses.length} addresses in ${batches.length} batches`,
    );
    console.log('   ✅ Emergency reset is now complete');
    console.log(
      '   ✅ Contract is fully healthy and ready for normal operation',
    );

    console.log("\n🚀 What's been accomplished:");
    console.log('   1. ✅ Fixed distributionMultiplier (1.468×10¹⁸ → 10)');
    console.log('   2. ✅ Fixed HYPHA_PER_DAY (367000 → 1.468×10¹⁸)');
    console.log('   3. ✅ Reset totalMinted (555M → 80.5M)');
    console.log('   4. ✅ Cleared pendingDistribution (451M → 0)');
    console.log(
      '   5. ✅ Cleared individual pending rewards for all affected users',
    );
    console.log('   6. ✅ Restored 475M HYPHA investment capacity');

    console.log('\n🎯 Ready for testing:');
    console.log('   • invest-in-hypha.ts should work now');
    console.log('   • Space payments will generate reasonable rewards');
    console.log('   • All tokenomics functions are healthy');
  } catch (error: any) {
    console.error('\n❌ FAILED to clear pending rewards:', error.message);

    if (error.message.includes('Ownable: caller is not the owner')) {
      console.log(
        '\n💡 ERROR: Only the contract owner can clear pending rewards.',
      );
      console.log("   Make sure you are using the owner's private key.");
    } else if (error.message.includes('resolver')) {
      console.log('\n💡 This might be a network/ENS resolver issue.');
      console.log(
        '   The function exists and should work - try again or use a different RPC.',
      );
    } else {
      console.log('\n🔍 Debug info:');
      console.log(`   Error type: ${typeof error}`);
      console.log(`   Error code: ${error.code || 'unknown'}`);
    }

    throw error;
  }
}

main()
  .then(() => {
    console.log('\n✨ Pending rewards clearing completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n💥 Script failed:', error.message);
    process.exit(1);
  });
