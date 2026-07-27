import { ethers, run } from 'hardhat';

/**
 * Deploy XpfUsdOracle — a Chainlink-compatible XPF/USD feed derived from the
 * Base EUR/USD feed and the fixed CFP franc peg (1000 XPF = 8.38 EUR).
 *
 * Usage:
 *   npx hardhat run scripts/xpf-usd-oracle.deploy.ts --network base-mainnet
 *
 * Override the underlying feed (e.g. for a testnet):
 *   EUR_USD_FEED=0x... npx hardhat run scripts/xpf-usd-oracle.deploy.ts --network base-mainnet
 */

// Chainlink EUR/USD on Base mainnet
// https://docs.chain.link/data-feeds/price-feeds/addresses?network=base
const EUR_USD_FEED_BASE = '0xc91D87E81faB8f93699ECf7Ee9B44D11e1D53F0F';

async function main() {
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();

  const eurUsdFeed = ethers.getAddress(
    (process.env.EUR_USD_FEED || EUR_USD_FEED_BASE).toLowerCase(),
  );

  console.log('Network:', network.name, `(chain ID: ${network.chainId})`);
  console.log('Deployer:', signer.address);
  console.log(
    'Balance:',
    ethers.formatEther(await ethers.provider.getBalance(signer.address)),
    'ETH',
  );
  console.log('EUR/USD feed:', eurUsdFeed);
  console.log('----------------------------------------------------');

  const Factory = await ethers.getContractFactory('XpfUsdOracle');
  const oracle = await Factory.deploy(eurUsdFeed);
  await oracle.waitForDeployment();

  const address = await oracle.getAddress();
  console.log('✅ XpfUsdOracle deployed to:', address);

  // Sanity check — the adapter must report a live, positive XPF/USD rate
  const decimals = Number(await oracle.decimals());
  const [, answer, , updatedAt] = await oracle.latestRoundData();
  const rate = Number(answer) / Math.pow(10, decimals);
  console.log('');
  console.log(`   XPF/USD: ${rate.toFixed(decimals)} (${decimals} decimals)`);
  console.log(`   1 USD  ≈ ${(1 / rate).toFixed(2)} XPF`);
  console.log(
    `   Updated: ${new Date(Number(updatedAt) * 1000).toISOString()}`,
  );

  if (process.env.ETHERSCAN_API_KEY || process.env.BASESCAN_API_KEY) {
    console.log('');
    console.log('Verifying on Basescan...');
    try {
      await run('verify:verify', {
        address,
        constructorArguments: [eurUsdFeed],
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : String(error ?? '');
      console.log('⚠️  Verification failed:', message.slice(0, 200));
      console.log(
        `   Retry manually: npx hardhat verify --network base-mainnet ${address} ${eurUsdFeed}`,
      );
    }
  } else {
    console.log('');
    console.log('Verify with:');
    console.log(
      `  npx hardhat verify --network base-mainnet ${address} ${eurUsdFeed}`,
    );
  }

  console.log('');
  console.log('Next step — wire the address into the app:');
  console.log(
    `  packages/core/src/common/web3/token-backing-vault.ts → CURRENCY_FEEDS.XPF = '${address}'`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
