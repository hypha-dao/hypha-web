import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

async function main(): Promise<void> {
  const hyphaTokenAddress = '0x8b93862835C36e9689E9bb1Ab21De3982e266CD3';

  console.log(`Using RPC: ${process.env.RPC_URL}`);
  console.log(`HyphaToken Contract: ${hyphaTokenAddress}\n`);

  const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

  const abi = ['function distributionMultiplier() view returns (uint256)'];

  const contract = new ethers.Contract(hyphaTokenAddress, abi, provider);

  try {
    const multiplier = await contract.distributionMultiplier();

    console.log('='.repeat(80));
    console.log('📊 DISTRIBUTION MULTIPLIER STATUS');
    console.log('='.repeat(80));
    console.log(
      `\n💰 Current Distribution Multiplier: ${multiplier.toString()}`,
    );
    console.log(`\nℹ️  This means for every HYPHA paid or equivalent in USDC:`);
    console.log(
      `   - ${multiplier.toString()}x additional HYPHA is added to the rewards pool`,
    );
    console.log(
      `   - Total distributed = (1 + ${multiplier.toString()}) = ${(
        1n + multiplier
      ).toString()}x the payment amount`,
    );
    console.log('='.repeat(80));
  } catch (error: any) {
    console.error('❌ Error fetching distribution multiplier:', error.message);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
