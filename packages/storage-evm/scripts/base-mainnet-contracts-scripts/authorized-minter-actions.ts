import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

/**
 * Backend example: trigger the three "authorized minter" functions.
 *
 * Background (PR #2303 — feat: authorized minters for space tokens)
 * -----------------------------------------------------------------
 * When a space token is created, the issuer can supply one or more
 * "authorized minter" addresses. Those addresses are granted the right to call
 * three functions on the token directly — WITHOUT going through a DAO proposal
 * + vote (which is what the space executor normally requires):
 *
 *   1. mint(to, amount)
 *   2. burnFrom(from, amount)
 *   3. batchSetCreditWhitelistAddresses(accounts, allowed)
 *
 * This means a backend service that holds the PRIVATE KEY of an authorized
 * minter can sign and broadcast these calls itself. That is exactly what this
 * example demonstrates: load the authorized minter key, connect to a deployed
 * token, and fire each of the three calls.
 *
 * SECURITY: the private key controls real on-chain minting/burning power. Treat
 * it like any other secret — keep it in an env var / secret manager, never in
 * source control, and scope its use to the backend that needs it.
 *
 * Usage
 * -----
 * 1. Set the env vars below (RPC_URL + AUTHORIZED_MINTER_PRIVATE_KEY).
 * 2. Edit the CONFIGURATION block: TOKEN_ADDRESS and the action params.
 * 3. Run:
 *      cd packages/storage-evm
 *      ts-node scripts/base-mainnet-contracts-scripts/authorized-minter-actions.ts
 *    (or via hardhat:)
 *      npx hardhat run scripts/base-mainnet-contracts-scripts/authorized-minter-actions.ts --network base
 */

// ============================== CONFIGURATION ==============================

// The space token (RegularSpaceToken / OwnershipSpaceToken / DecayingSpaceToken)
// the authorized minter should act on.
const TOKEN_ADDRESS = '0xc82721CEB329f10284c54Aa61C7341988713683D';

// Token uses 18 decimals (standard for these contracts).
const TOKEN_DECIMALS = 18;

// Toggle which of the three actions to run in this invocation.
const RUN_MINT = true;
const RUN_BURN = true;
const RUN_SET_CREDIT_WHITELIST = true;

// --- mint(to, amount) ---
// Mint new tokens to a recipient (respects maxSupply + archived checks).
const MINT_TO = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';
const MINT_AMOUNT = '100'; // human units, converted with TOKEN_DECIMALS

// --- burnFrom(from, amount) ---
// Burn tokens from an address. Authorized minters burn WITHOUT needing an
// allowance (same privilege as the executor).
const BURN_FROM = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';
const BURN_AMOUNT = '10'; // human units

// --- batchSetCreditWhitelistAddresses(accounts, allowed) ---
// Grant (true) / revoke (false) per-address mutual-credit eligibility.
const CREDIT_WHITELIST_ACCOUNTS = [
  '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a',
];
const CREDIT_WHITELIST_ALLOWED = [true];

// Multiply current network gas fees by this factor to avoid underpriced txs.
const GAS_PRICE_MULTIPLIER = 150n; // 150 = +50%

// ===========================================================================

// Minimal ABI: only what an authorized minter needs (the three write calls)
// plus a few view helpers for sanity checks and logging.
const tokenAbi = [
  // --- authorized-minter write functions ---
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'mint',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address', name: 'from', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'burnFrom',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { internalType: 'address[]', name: 'accounts', type: 'address[]' },
      { internalType: 'bool[]', name: 'allowed', type: 'bool[]' },
    ],
    name: 'batchSetCreditWhitelistAddresses',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // --- view helpers ---
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'isAuthorizedMinter',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: '', type: 'address' }],
    name: 'isCreditWhitelistedAddress',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'executor',
    outputs: [{ internalType: 'address', name: '', type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ internalType: 'string', name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
];

/**
 * Build EIP-1559 gas overrides bumped by GAS_PRICE_MULTIPLIER. Returns an empty
 * object on chains/providers that don't expose 1559 fee data.
 */
async function getGasOverrides(
  provider: ethers.JsonRpcProvider,
): Promise<{ maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint }> {
  const feeData = await provider.getFeeData();
  const overrides: { maxFeePerGas?: bigint; maxPriorityFeePerGas?: bigint } =
    {};

  if (feeData.maxFeePerGas) {
    overrides.maxFeePerGas =
      (feeData.maxFeePerGas * GAS_PRICE_MULTIPLIER) / 100n;
  }
  if (feeData.maxPriorityFeePerGas) {
    overrides.maxPriorityFeePerGas =
      (feeData.maxPriorityFeePerGas * GAS_PRICE_MULTIPLIER) / 100n;
  }
  return overrides;
}

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('AUTHORIZED MINTER — BACKEND ACTIONS EXAMPLE');
  console.log('='.repeat(70));

  // ----- 1. Connect using the authorized minter's private key -----
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    console.error('❌ Missing RPC_URL in environment.');
    process.exit(1);
  }

  // This is the key that was registered as an authorized minter at token
  // creation. Falls back to PRIVATE_KEY for convenience in local testing.
  const rawKey =
    process.env.AUTHORIZED_MINTER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error(
      '❌ Missing AUTHORIZED_MINTER_PRIVATE_KEY (or PRIVATE_KEY) in environment.',
    );
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const minterKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const wallet = new ethers.Wallet(minterKey, provider);

  console.log(`\n🔑 Authorized minter address: ${wallet.address}`);
  console.log(`🪙 Token address:             ${TOKEN_ADDRESS}`);

  const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);

  // ----- 2. Sanity-check that this wallet is actually an authorized minter -----
  let symbol = 'TOKEN';
  try {
    symbol = await token.symbol();
  } catch {
    // symbol() is optional for the example; ignore failures.
  }

  const isMinter = await token.isAuthorizedMinter(wallet.address);
  const executor = await token.executor();
  console.log(`🏷️  Token symbol:             ${symbol}`);
  console.log(`🤖 Token executor:           ${executor}`);
  console.log(`✅ isAuthorizedMinter[wallet]: ${isMinter ? 'YES' : 'NO'}`);

  if (!isMinter && wallet.address.toLowerCase() !== executor.toLowerCase()) {
    console.error(
      '\n❌ This wallet is neither an authorized minter nor the executor.',
    );
    console.error(
      '   The three calls below would revert with "!executor". Make sure the',
    );
    console.error(
      '   address was supplied as an authorized minter during token creation,',
    );
    console.error('   or granted later via batchSetAuthorizedMinters(...).');
    process.exit(1);
  }

  // ----- 3. ACTION 1: mint(to, amount) -----
  if (RUN_MINT) {
    console.log('\n' + '-'.repeat(70));
    console.log('ACTION 1 — mint(to, amount)');
    console.log('-'.repeat(70));
    const amount = ethers.parseUnits(MINT_AMOUNT, TOKEN_DECIMALS);
    console.log(`   Minting ${MINT_AMOUNT} ${symbol} to ${MINT_TO}`);

    const before = await token.balanceOf(MINT_TO);
    const overrides = await getGasOverrides(provider);
    const tx = await token.mint(MINT_TO, amount, overrides);
    console.log(`   Tx submitted: ${tx.hash}`);
    await tx.wait();

    const after = await token.balanceOf(MINT_TO);
    console.log(
      `   ✅ Minted. Balance ${ethers.formatUnits(
        before,
        TOKEN_DECIMALS,
      )} -> ${ethers.formatUnits(after, TOKEN_DECIMALS)} ${symbol}`,
    );
  }

  // ----- 4. ACTION 2: burnFrom(from, amount) -----
  if (RUN_BURN) {
    console.log('\n' + '-'.repeat(70));
    console.log('ACTION 2 — burnFrom(from, amount)');
    console.log('-'.repeat(70));
    const amount = ethers.parseUnits(BURN_AMOUNT, TOKEN_DECIMALS);
    console.log(
      `   Burning ${BURN_AMOUNT} ${symbol} from ${BURN_FROM} (no allowance needed)`,
    );

    const before = await token.balanceOf(BURN_FROM);
    const overrides = await getGasOverrides(provider);
    const tx = await token.burnFrom(BURN_FROM, amount, overrides);
    console.log(`   Tx submitted: ${tx.hash}`);
    await tx.wait();

    const after = await token.balanceOf(BURN_FROM);
    console.log(
      `   ✅ Burned. Balance ${ethers.formatUnits(
        before,
        TOKEN_DECIMALS,
      )} -> ${ethers.formatUnits(after, TOKEN_DECIMALS)} ${symbol}`,
    );
  }

  // ----- 5. ACTION 3: batchSetCreditWhitelistAddresses(accounts, allowed) -----
  if (RUN_SET_CREDIT_WHITELIST) {
    console.log('\n' + '-'.repeat(70));
    console.log(
      'ACTION 3 — batchSetCreditWhitelistAddresses(accounts, allowed)',
    );
    console.log('-'.repeat(70));

    if (CREDIT_WHITELIST_ACCOUNTS.length !== CREDIT_WHITELIST_ALLOWED.length) {
      console.error(
        '   ❌ accounts and allowed arrays must be the same length.',
      );
    } else {
      CREDIT_WHITELIST_ACCOUNTS.forEach((acct, i) => {
        console.log(
          `   ${
            CREDIT_WHITELIST_ALLOWED[i] ? 'GRANT ' : 'REVOKE'
          } credit eligibility: ${acct}`,
        );
      });

      const overrides = await getGasOverrides(provider);
      const tx = await token.batchSetCreditWhitelistAddresses(
        CREDIT_WHITELIST_ACCOUNTS,
        CREDIT_WHITELIST_ALLOWED,
        overrides,
      );
      console.log(`   Tx submitted: ${tx.hash}`);
      await tx.wait();

      for (const acct of CREDIT_WHITELIST_ACCOUNTS) {
        const allowed = await token.isCreditWhitelistedAddress(acct);
        console.log(`   ✅ ${acct} credit-whitelisted: ${allowed}`);
      }
    }
  }

  // ----- Summary -----
  console.log('\n' + '='.repeat(70));
  const totalSupply = await token.totalSupply();
  console.log(
    `📊 Token total supply: ${ethers.formatUnits(
      totalSupply,
      TOKEN_DECIMALS,
    )} ${symbol}`,
  );
  console.log('✅ Done.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
