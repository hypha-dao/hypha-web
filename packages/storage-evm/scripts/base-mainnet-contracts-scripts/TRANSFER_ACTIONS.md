# Token Transfer — Backend Action

Example + guide for sending a space token with the standard ERC-20 **transfer**
function directly from a backend, using the private key of a wallet that holds a
balance (e.g. a treasury / payout wallet).

- **Script:** [`transfer-token-actions.ts`](./transfer-token-actions.ts)

This mirrors the [authorized-minter example](./AUTHORIZED_MINTER_ACTIONS.md),
but for token movement instead of mint/burn/credit-whitelist.

---

## What "transfer" means on a space token

Space tokens (`RegularSpaceToken`, `OwnershipSpaceToken`, `DecayingSpaceToken`)
are ERC-20 tokens. Unlike `mint` / `burnFrom`, transferring is **not** a
privileged "authorized minter" action — any wallet that holds a balance can move
its own tokens with the normal ERC-20 entrypoint, **no proposal, no vote**:

```solidity
transfer(address to, uint256 amount) // send your own tokens to `to`
```

> Why not `transferFrom`? `transfer` moves the **sender's own** tokens, which is
> all you need to pay out from a wallet you control. `transferFrom` exists for
> the separate case where a third party spends an allowance another holder
> granted them via `approve` (DEX swaps, escrow, etc.). For a backend that sends
> from its own treasury wallet, plain `transfer` is enough.

### Transfer rules enforced by the token

`transfer` runs through `_validateTransferAccess(from, to, spender)`:

- **`transferable`** must be `true` (or the sender must be the **executor**).
  Otherwise the call reverts with `!transferable`.
- If **`useTransferWhitelist`** is on, the **sender** must be allowed to send —
  `canAccountTransfer(from) == true` (direct whitelist or member of a
  transfer-whitelisted space). Otherwise it reverts with `!send whitelist`.
- If **`useReceiveWhitelist`** is on, the **recipient** must be allowed to
  receive — `canAccountReceive(to) == true`. Otherwise it reverts with
  `!recv whitelist`.

The executor bypasses these checks.

### Why this matters for a backend

Because a transfer only requires a signature from a wallet with a balance
(subject to the rules above), a backend service that **holds that wallet's
private key** can sign and broadcast transfers itself — there is no on-chain
proposal/vote step to wait on. That is what this example demonstrates.

---

## How the example works

The script ([`transfer-token-actions.ts`](./transfer-token-actions.ts)) is
structured like the other interaction scripts in this folder (a `CONFIGURATION`
block at the top, a minimal ABI, then a `main()` that logs each step). It:

1. Loads the holder key from `TRANSFER_PRIVATE_KEY` (falls back to `PRIVATE_KEY`)
   and connects to `RPC_URL`.
2. Connects to the token at `TOKEN_ADDRESS` and **sanity-checks** that
   `transferable` is `true` (or the wallet is the executor), so you get a clear
   error instead of a raw `!transferable` revert.
3. Pre-checks `canAccountTransfer(sender)` / `canAccountReceive(to)` and aborts
   with a clear message if a whitelist rule would block the call.
4. Sends `TRANSFER_AMOUNT` to `TRANSFER_TO`, logging before/after balances for
   both parties.

Gas fees are pulled from the network and bumped by `GAS_PRICE_MULTIPLIER` to
avoid "transaction underpriced" failures (same approach as the other scripts).

---

## Configuration

### Environment variables (`.env` in `packages/storage-evm`)

```bash
RPC_URL="https://base-mainnet.g.alchemy.com/v2/<your-key>"

# The key of the wallet that holds the tokens (treasury / payout wallet).
# Keep this in a secret manager in production — it controls real funds.
TRANSFER_PRIVATE_KEY="<holder-private-key>"
```

### In-script config (top of `transfer-token-actions.ts`)

| Constant | Meaning |
|----------|---------|
| `TOKEN_ADDRESS` | The deployed space token to transfer |
| `TOKEN_DECIMALS` | Token decimals (18 for these contracts) |
| `TRANSFER_TO`, `TRANSFER_AMOUNT` | `transfer` recipient + amount (human units) |
| `GAS_PRICE_MULTIPLIER` | Fee bump (`150` = +50%) |

---

## Running it

```bash
cd packages/storage-evm

# with ts-node (like the other scripts in this folder)
ts-node scripts/base-mainnet-contracts-scripts/transfer-token-actions.ts

# or through hardhat (uses the network's configured signer/RPC)
npx hardhat run scripts/base-mainnet-contracts-scripts/transfer-token-actions.ts --network base
```

---

## Adapting it into a real backend service

The `main()` body is the reusable part. In a long-running service you would
typically:

- Instantiate the provider + wallet once at startup from secrets, not per call.
- Expose a `transfer(to, amount)` function instead of the top-level config.
- Pre-check `transferable`, `canAccountTransfer(from)` and `canAccountReceive(to)`
  before sending, to fail fast with a meaningful error.
- `await tx.wait()` (or poll for the receipt) and surface the tx hash to the
  caller; handle reverts (`!transferable`, `!send whitelist`, `!recv whitelist`,
  `ERC20: transfer amount exceeds balance`) explicitly.

```ts
const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);

// transfer your own tokens
await (await token.transfer(to, ethers.parseUnits(amount, 18))).wait();
```

---

## Security notes

- The holder private key grants real on-chain power to **move funds**. Store it
  in a secret manager, never commit it, and scope it to the minimum surface that
  needs it.
- Prefer a dedicated key per backend/service so it can be rotated without
  affecting others.
- The token still enforces `transferable`, the send/receive whitelists, and the
  balance limit. These are contract-level guards, not reasons to relax key
  hygiene.
