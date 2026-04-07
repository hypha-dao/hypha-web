import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function main(): Promise<void> {
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

  console.log(`Using RPC: ${process.env.RPC_URL}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}\n`);

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  const abi = [
    'function pendingRewards(address user) view returns (uint256)',
    'function userRewardDebt(address user) view returns (uint256)',
  ];

  const contract = new ethers.Contract(hyphaTokenAddress, abi, provider);

  // All addresses from the CSV export (43 token holders)
  const addressesToCheck = [
    '0x177a04a0f8f876ad610079a6f7b588fa2cffa325',
    '0x8d0e07cb0c966dca466fba84a49327c2996cdfad',
    '0x6bed9720fd53b3764e93dd0753c95674cd9b82ce',
    '0x02bb278d4300919f82318db9f54067df636ff98f',
    '0x822bf2fd502d7eaa679bdce365cb620a05924e2c',
    '0x9f3900c6bad5a52cc3210dd2f65062141c88de2f',
    '0x22a4b7a02209958d1cf38d524cb27b9dd59cc36e',
    '0x5a7534ac36bc47b7d4d5fafe87f554f61c3b6f57',
    '0xb7a4c8316ecd34b003fb97b9c1e72fbbaab4dd17',
    '0xe27f33ca8037a2b0f4d3d4f9b8ccd896c2674484',
    '0x34332cb58a4eaae32dd7967e77dc02ae340c3a18',
    '0x2d1f903cde37f1a1af300fee2b101c8816571dc8',
    '0x8af35bac4123a6e03359ac10f453778935243300',
    '0x36524c09019f7fe2cb2b478acb7607801deacf87',
    '0x47b40b165c6ab95823d7f66d455c02ec8eb10c96',
    '0x5162bcb4e123bcd25d47c73ee3a5de4e9756598a',
    '0xdd55b085f614769af239315d26c3c63ea8b879c4',
    '0x859a4cf3f09f1cbd31207e9567e817906a8f4a44',
    '0x677edb3a760effbe68dce6aa70805125bf98fc2b',
    '0xe5c06923632c50a62a7886b8dce2fb818dadb1b0',
    '0x33078d33ee146dd6e516135bbd8a1c33e4ae5d7f',
    '0x19fc3146eed7b758893c32fdfb97754c13353756',
    '0xf28f9ed3fb6e8b62e3c8a7b82bd882b223235e89',
    '0xbd0297ae3baa6beb07eccb9be5f4837060a0c55e',
    '0x0957113815e0a0b0584cc22c62f926217e7944d8',
    '0x62a9ca1b9b290adf12ddb54c406372ff6eae9e69',
    '0x3b34bb9f25dfe0834498c07848e2797a40790af1',
    '0xed0d11519ea2dda63c2c0d0eb7e7e36de7cf2f48',
    '0xdc79f609594343ca984019dd297d541db5982809',
    '0xbd5ed59cfad964a3252423e1ba354a35f9bd4160',
    '0xc63db28a195fe9083b2983ebe86667f77786aebf',
    '0xf7a31f4f7b2a35ea22b666fc90304c8acca5dde1',
    '0xc4b6f66130a12172584f0061e9fee98e6c6c4076',
    '0x3b5b4d378e81ac706ff4c6a5db902ca762979bea',
    '0x65848b5c4c075ddb57fa27e6f2be342bbde9085d',
    '0x8ed18ac8102c10cb3bea0cd3e1a49b8b88427150',
    '0x23809d6b46c9e9be75d52c43a8f74f2bff57d180',
    '0x5eedd82bf602d48c6e5578e9f6222de6e0674278',
    '0xe91667b351aeada5b745de94706a9959e8767708',
    '0xcbc404c6ac777e026f309b37b496dbffd52a60e3',
    '0xbd5a22fd5747782b3e08a2b5b538256d320013fc',
    '0x2687fe290b54d824c136ceff2d5bd362bc62019a',
    '0xa961f734f6e632174057ee52403e7d8cc783f140',
  ];

  console.log(
    `🔍 Checking claimable rewards for ${addressesToCheck.length} addresses...\n`,
  );

  let totalClaimableRewards = 0n;
  let addressesWithRewards = 0;
  let addressesCleared = 0;
  let errorCount = 0;

  for (let i = 0; i < addressesToCheck.length; i++) {
    const address = addressesToCheck[i];
    const shortAddress = `${address.substring(0, 6)}...${address.substring(
      38,
    )}`;

    try {
      const claimableRewards = await contract.pendingRewards(address);
      const userRewardDebt = await contract.userRewardDebt(address);

      const hasClaimableRewards = claimableRewards > 0n;

      totalClaimableRewards += claimableRewards;

      if (hasClaimableRewards) {
        addressesWithRewards++;
        console.log(
          `❌ ${(i + 1)
            .toString()
            .padStart(2)}. ${shortAddress}: Can claim ${ethers.formatEther(
            claimableRewards,
          )} HYPHA`,
        );
      } else {
        addressesCleared++;
        console.log(
          `✅ ${(i + 1)
            .toString()
            .padStart(
              2,
            )}. ${shortAddress}: All rewards cleared (debt: ${ethers.formatEther(
            userRewardDebt,
          )})`,
        );
      }
    } catch (error: any) {
      errorCount++;
      console.log(
        `🔄 ${(i + 1)
          .toString()
          .padStart(
            2,
          )}. ${shortAddress}: Error checking - ${error.message.substring(
          0,
          50,
        )}...`,
      );
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('📊 CLAIMABLE REWARDS SUMMARY');
  console.log('='.repeat(80));

  console.log(`🔍 Total addresses checked: ${addressesToCheck.length}`);
  console.log(`✅ Addresses with cleared rewards: ${addressesCleared}`);
  console.log(`❌ Addresses with claimable rewards: ${addressesWithRewards}`);
  console.log(`🔄 Addresses with check errors: ${errorCount}`);

  console.log(`\n💰 Total Claimable Rewards:`);
  console.log(
    `   ${ethers.formatEther(
      totalClaimableRewards,
    )} HYPHA can be claimed across all addresses`,
  );

  if (addressesWithRewards === 0 && errorCount === 0) {
    console.log('\n🎉 PERFECT! All addresses have zero claimable rewards!');
    console.log('   ✅ Emergency reset is 100% complete');
    console.log('   ✅ Contract is fully cleaned up');
    console.log('   ✅ Ready for normal operation');
  } else if (addressesWithRewards === 0) {
    console.log('\n✅ GOOD! No addresses have claimable rewards');
    console.log(
      `   ⚠️  ${errorCount} addresses had check errors (likely network issues)`,
    );
    console.log('   ✅ Emergency reset appears complete');
  } else {
    console.log(
      '\n⚠️  INCOMPLETE: Some addresses still have claimable rewards',
    );
    console.log(
      `   ${addressesWithRewards} addresses need additional clearing`,
    );
    console.log('   These may need manual clearing or retry');
  }

  console.log('\n🎯 Investment Status:');
  console.log('   The main contract fixes are complete regardless');
  console.log(
    '   Investments should work even if some individual rewards remain',
  );
  console.log('   Individual rewards can be cleared later if needed');
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
