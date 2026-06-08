import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

/**
 * Backend example: send a space token with the standard ERC-20 `transfer`.
 *
 * Background
 * ----------
 * Space tokens (RegularSpaceToken / OwnershipSpaceToken / DecayingSpaceToken)
 * are ERC-20 tokens, so any wallet that HOLDS a balance can move its own tokens
 * with the normal ERC-20 entrypoint — no DAO proposal + vote required:
 *
 *   transfer(to, amount) — send your own tokens to a recipient
 *
 * Unlike mint/burn, transfers are NOT a privileged "authorized minter" action;
 * they are gated by the token's own transfer rules instead:
 *
 *   - `transferable` must be true (or the sender must be the executor).
 *   - If `useTransferWhitelist` is on, the SENDER must be allowed to send
 *     (`canAccountTransfer(from) == true`).
 *   - If `useReceiveWhitelist` is on, the RECIPIENT must be allowed to receive
 *     (`canAccountReceive(to) == true`).
 *
 * This means a backend service that holds the PRIVATE KEY of a wallet with a
 * balance (e.g. a treasury / payout wallet) can sign and broadcast transfers
 * itself. That is what this example demonstrates: load the holder key, connect
 * to a deployed token, sanity-check the transfer rules, and send.
 *
 * SECURITY: the private key controls real on-chain funds. Treat it like any
 * other secret — keep it in an env var / secret manager, never in source
 * control, and scope its use to the backend that needs it.
 *
 * Usage
 * -----
 * 1. Set the env vars below (RPC_URL + TRANSFER_PRIVATE_KEY).
 * 2. Edit the CONFIGURATION block: TOKEN_ADDRESS and the transfer params.
 * 3. Run:
 *      cd packages/storage-evm
 *      ts-node scripts/base-mainnet-contracts-scripts/transfer-token-actions.ts
 *    (or via hardhat:)
 *      npx hardhat run scripts/base-mainnet-contracts-scripts/transfer-token-actions.ts --network base
 */

// ============================== CONFIGURATION ==============================

// The space token (RegularSpaceToken / OwnershipSpaceToken / DecayingSpaceToken)
// to transfer.
const TOKEN_ADDRESS = '0xc82721CEB329f10284c54Aa61C7341988713683D';

// Token uses 18 decimals (standard for these contracts).
const TOKEN_DECIMALS = 18;

// --- transfer(to, amount) ---
// Send tokens FROM the connected wallet TO the recipient.
const TRANSFER_TO = '0x2687fe290b54d824c136Ceff2d5bD362Bc62019a';
const TRANSFER_AMOUNT = '25'; // human units, converted with TOKEN_DECIMALS

// Multiply current network gas fees by this factor to avoid underpriced txs.
const GAS_PRICE_MULTIPLIER = 150n; // 150 = +50%

// ===========================================================================

// Minimal ABI: the ERC-20 transfer call plus a few view helpers for sanity
// checks and logging.
const tokenAbi = [
  // --- ERC-20 write function ---
  {
    inputs: [
      { internalType: 'address', name: 'to', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // --- view helpers ---
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'transferable',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'canAccountTransfer',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
    name: 'canAccountReceive',
    outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
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
  console.log('TOKEN TRANSFER — BACKEND ACTION EXAMPLE');
  console.log('='.repeat(70));

  // ----- 1. Connect using the token holder's private key -----
  const rpcUrl = process.env.RPC_URL;
  if (!rpcUrl) {
    console.error('❌ Missing RPC_URL in environment.');
    process.exit(1);
  }

  // The key of the wallet that holds the tokens (treasury / payout wallet).
  // Falls back to PRIVATE_KEY for convenience in local testing.
  const rawKey = process.env.TRANSFER_PRIVATE_KEY || process.env.PRIVATE_KEY;
  if (!rawKey) {
    console.error(
      '❌ Missing TRANSFER_PRIVATE_KEY (or PRIVATE_KEY) in environment.',
    );
    process.exit(1);
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const holderKey = rawKey.startsWith('0x') ? rawKey : `0x${rawKey}`;
  const wallet = new ethers.Wallet(holderKey, provider);

  console.log(`\n🔑 Holder address:  ${wallet.address}`);
  console.log(`🪙 Token address:   ${TOKEN_ADDRESS}`);

  const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);

  // ----- 2. Sanity-check the token's transfer rules -----
  let symbol = 'TOKEN';
  try {
    symbol = await token.symbol();
  } catch {
    // symbol() is optional for the example; ignore failures.
  }

  const transferable = await token.transferable();
  const executor = await token.executor();
  const isExecutor = wallet.address.toLowerCase() === executor.toLowerCase();
  console.log(`🏷️  Token symbol:    ${symbol}`);
  console.log(`🤖 Token executor:  ${executor}`);
  console.log(`🔁 transferable:    ${transferable ? 'YES' : 'NO'}`);

  if (!transferable && !isExecutor) {
    console.error(
      '\n❌ Transfers are disabled (transferable = false) and this wallet is',
    );
    console.error('   not the executor. transfer would revert with');
    console.error(
      "   '!transferable'. Enable transfers via setTransferable(true) (executor)",
    );
    console.error('   or run as the executor.');
    process.exit(1);
  }

  // ----- 3. transfer(to, amount) -----
  console.log('\n' + '-'.repeat(70));
  console.log('transfer(to, amount)');
  console.log('-'.repeat(70));
  const amount = ethers.parseUnits(TRANSFER_AMOUNT, TOKEN_DECIMALS);
  console.log(`   Transferring ${TRANSFER_AMOUNT} ${symbol} to ${TRANSFER_TO}`);

  const canSend = await token.canAccountTransfer(wallet.address);
  const canRecv = await token.canAccountReceive(TRANSFER_TO);
  if (!canSend) {
    console.error(
      "   ❌ Sender is not allowed to transfer ('!send whitelist'). Aborting.",
    );
    process.exit(1);
  }
  if (!canRecv) {
    console.error(
      "   ❌ Recipient is not allowed to receive ('!recv whitelist'). Aborting.",
    );
    process.exit(1);
  }

  const beforeFrom = await token.balanceOf(wallet.address);
  const beforeTo = await token.balanceOf(TRANSFER_TO);
  const overrides = await getGasOverrides(provider);
  const tx = await token.transfer(TRANSFER_TO, amount, overrides);
  console.log(`   Tx submitted: ${tx.hash}`);
  await tx.wait();

  const afterFrom = await token.balanceOf(wallet.address);
  const afterTo = await token.balanceOf(TRANSFER_TO);
  console.log(
    `   ✅ Sent. Sender ${ethers.formatUnits(
      beforeFrom,
      TOKEN_DECIMALS,
    )} -> ${ethers.formatUnits(afterFrom, TOKEN_DECIMALS)} ${symbol}`,
  );
  console.log(
    `      Recipient ${ethers.formatUnits(
      beforeTo,
      TOKEN_DECIMALS,
    )} -> ${ethers.formatUnits(afterTo, TOKEN_DECIMALS)} ${symbol}`,
  );

  console.log('\n' + '='.repeat(70));
  console.log('✅ Done.');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('\n❌ Script failed:', error);
    process.exit(1);
  });
