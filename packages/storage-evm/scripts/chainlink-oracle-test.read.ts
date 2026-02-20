import { ethers } from 'hardhat';

/**
 * Read all relevant Chainlink FX + crypto price feeds on Base mainnet.
 *
 * Usage (on a local Base fork — deploys automatically):
 *   npx hardhat run scripts/chainlink-oracle-test.read.ts
 *
 * Usage (on real Base mainnet — after deploying the test contract):
 *   ORACLE_TEST_ADDRESS=0x... npx hardhat run scripts/chainlink-oracle-test.read.ts --network base-mainnet
 */

// ──────────────────────────────────────────────────────
//  Chainlink feed addresses on Base mainnet
//  Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=base&page=1
//
//  ⚠️  VERIFY these addresses before use! They may change.
//  Check the link above for the latest addresses.
// ──────────────────────────────────────────────────────

const FEEDS_RAW: { name: string; address: string }[] = [
  // Crypto / USD
  { name: 'ETH/USD', address: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70' },
  { name: 'BTC/USD', address: '0x64c911996D3c6aC71f9b455B1E8E7266BcbD848F' },
  { name: 'USDC/USD', address: '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B' },

  // FX / USD — these are the fiat currencies for the vault's priceCurrencyFeed
  // Source: https://docs.chain.link/data-feeds/price-feeds/addresses?network=base
  // Note: JPY/USD is not available on Base mainnet
  { name: 'EUR/USD', address: '0xc91D87E81faB8f93699ECf7Ee9B44D11e1D53F0F' },
  { name: 'GBP/USD', address: '0xCceA6576904C118037695eB71195a5425E69Fa15' },
  { name: 'AUD/USD', address: '0x46e51B8cA41d709928EdA9Ae43e42193E6CDf229' },
  { name: 'CAD/USD', address: '0xA840145F87572E82519d578b1F36340368a25D5d' },
  { name: 'CHF/USD', address: '0x3A1d6444fb6a402470098E23DaD0B7E86E14252F' },
];

// Normalize addresses to proper checksums
const FEEDS = FEEDS_RAW.map((f) => ({
  name: f.name,
  address: ethers.getAddress(f.address.toLowerCase()),
}));

async function main() {
  let contract: any;

  const deployedAddress = process.env.ORACLE_TEST_ADDRESS;

  if (deployedAddress) {
    console.log('Using deployed ChainlinkOracleTest at:', deployedAddress);
    contract = await ethers.getContractAt(
      'ChainlinkOracleTest',
      deployedAddress,
    );
  } else {
    console.log(
      'No ORACLE_TEST_ADDRESS set — deploying fresh (fork mode)...\n',
    );
    const Factory = await ethers.getContractFactory('ChainlinkOracleTest');
    contract = await Factory.deploy();
    await contract.waitForDeployment();
  }

  console.log('====================================================');
  console.log('  CHAINLINK PRICE FEED TEST — BASE');
  console.log('====================================================\n');

  let passCount = 0;
  let failCount = 0;

  for (const feed of FEEDS) {
    try {
      const result = await contract.readPrice(feed.address);

      const price = result.price;
      const decimals = Number(result.decimals);
      const staleSec = Number(result.stalenessSeconds);

      const priceFormatted = (Number(price) / Math.pow(10, decimals)).toFixed(
        decimals > 4 ? 6 : 4,
      );

      const staleStr =
        staleSec < 60
          ? `${staleSec}s ago`
          : staleSec < 3600
          ? `${Math.floor(staleSec / 60)}m ago`
          : `${Math.floor(staleSec / 3600)}h ${Math.floor(
              (staleSec % 3600) / 60,
            )}m ago`;

      const status = result.isStale ? '⚠️  STALE' : '✅';

      console.log(
        `  ${status}  ${feed.name.padEnd(10)} ${priceFormatted.padStart(
          14,
        )}  (${decimals} dec, updated ${staleStr})  [${result.description}]`,
      );

      if (!result.isStale && price > 0n) passCount++;
      else failCount++;
    } catch (err: any) {
      console.log(`  ❌  ${feed.name.padEnd(10)} FAILED  (${feed.address})`);
      console.log(`      Error: ${err.message?.slice(0, 100)}`);
      failCount++;
    }
  }

  console.log('\n----------------------------------------------------');
  console.log(`  Results: ${passCount} passed, ${failCount} failed/stale`);
  console.log('----------------------------------------------------');

  if (failCount > 0) {
    console.log('\n⚠️  Some feeds failed or are stale. Verify addresses at:');
    console.log(
      '   https://docs.chain.link/data-feeds/price-feeds/addresses?network=base&page=1',
    );
  } else {
    console.log('\n🎉 All feeds working! Ready for vault deployment.');
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
