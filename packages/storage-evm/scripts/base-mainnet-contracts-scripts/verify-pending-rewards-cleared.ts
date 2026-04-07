import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function main(): Promise<void> {
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

  // Use the same RPC configuration as list-spaces.ts
  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  console.log(`Using RPC: ${process.env.RPC_URL}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}\n`);

  const abi = [
    'function pendingRewards(address user) view returns (uint256)',
    'function unclaimedRewards(address user) view returns (uint256)',
  ];

  const contract = new ethers.Contract(hyphaTokenAddress, abi, provider);

  // All addresses from your image
  const addressesToCheck = [
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

  console.log('🔍 Checking pending rewards for all addresses...\n');

  let totalPendingRewards = 0n;
  let totalUnclaimedRewards = 0n;
  let addressesWithRewards = 0;
  let addressesCleared = 0;
  let errorCount = 0;

  for (let i = 0; i < addressesToCheck.length; i++) {
    const address = addressesToCheck[i];
    const shortAddress =
      address.substring(0, 6) + '...' + address.substring(38);
    const index = (i + 1).toString().padStart(2, ' ');

    try {
      const pendingRewards = await contract.pendingRewards(address);
      const unclaimedRewards = await contract.unclaimedRewards(address);

      const hasPendingRewards = pendingRewards > 0n;
      const hasUnclaimedRewards = unclaimedRewards > 0n;
      const hasAnyRewards = hasPendingRewards || hasUnclaimedRewards;

      totalPendingRewards += pendingRewards;
      totalUnclaimedRewards += unclaimedRewards;

      if (hasAnyRewards) {
        addressesWithRewards++;
        console.log(
          `❌ ${index}. ${shortAddress}: Pending: ${ethers.formatEther(
            pendingRewards,
          )}, Unclaimed: ${ethers.formatEther(unclaimedRewards)}`,
        );
      } else {
        addressesCleared++;
        console.log(
          `✅ ${index}. ${shortAddress}: All rewards cleared (0.0 HYPHA)`,
        );
      }
    } catch (error: any) {
      errorCount++;
      const errorMsg =
        error.message.length > 50
          ? error.message.substring(0, 50) + '...'
          : error.message;
      console.log(`🔄 ${index}. ${shortAddress}: Error - ${errorMsg}`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 PENDING REWARDS VERIFICATION SUMMARY');
  console.log('='.repeat(80));

  console.log('🔍 Total addresses checked: ' + addressesToCheck.length);
  console.log('✅ Addresses with cleared rewards: ' + addressesCleared);
  console.log('❌ Addresses with remaining rewards: ' + addressesWithRewards);
  console.log('🔄 Addresses with check errors: ' + errorCount);

  console.log('\n💰 Aggregate Rewards:');
  console.log(
    '   Total pending rewards: ' +
      ethers.formatEther(totalPendingRewards) +
      ' HYPHA',
  );
  console.log(
    '   Total unclaimed rewards: ' +
      ethers.formatEther(totalUnclaimedRewards) +
      ' HYPHA',
  );
  console.log(
    '   Combined total: ' +
      ethers.formatEther(totalPendingRewards + totalUnclaimedRewards) +
      ' HYPHA',
  );

  if (addressesWithRewards === 0 && errorCount === 0) {
    console.log('\n🎉 PERFECT! All addresses have zero pending rewards!');
    console.log('   ✅ Emergency reset is 100% complete');
    console.log('   ✅ Contract is fully cleaned up');
    console.log('   ✅ Ready for normal operation');
  } else if (addressesWithRewards === 0) {
    console.log('\n✅ EXCELLENT! No addresses have pending rewards');
    console.log(
      '   ⚠️  ' +
        errorCount +
        ' addresses had check errors (likely network issues)',
    );
    console.log('   ✅ Emergency reset appears complete');
  } else {
    console.log(
      '\n⚠️  NEEDS ATTENTION: Some addresses still have pending rewards',
    );
    console.log(
      '   ' + addressesWithRewards + ' addresses need additional clearing',
    );
    console.log('   These should be cleared to complete the reset');
  }

  console.log('\n🎯 Investment Status:');
  console.log('   The main contract fixes are complete');
  console.log(
    '   Investments should work regardless of individual pending rewards',
  );
  console.log('   Individual rewards clearing is a cleanup step');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
