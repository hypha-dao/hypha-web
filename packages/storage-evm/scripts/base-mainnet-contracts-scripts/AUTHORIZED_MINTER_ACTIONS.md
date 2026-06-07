# Authorized Minter — Backend Actions

Example + guide for triggering the three "authorized minter" functions added in
[PR #2303 — _feat: authorized minters for space tokens_](https://github.com/hypha-dao/hypha-web/pull/2303)
directly from a backend, using a private key that was registered as an
authorized minter when the token was created.

- **Script:** [`authorized-minter-actions.ts`](./authorized-minter-actions.ts)

---

## What PR #2303 changed

Normally, privileged token operations on a space token can only be performed by
the **space executor**, and the executor only acts when a DAO **proposal** is
created and **voted** through. That is the right model for governance, but it is
heavyweight for automated/back-office flows.

PR #2303 adds an `isAuthorizedMinter` mapping to the token contracts
(`RegularSpaceToken`, `OwnershipSpaceToken`, `DecayingSpaceToken`). Any address in that mapping is granted the right to
call three functions **directly** — no proposal, no vote:

| # | Function | What it does | Authorization check |
|---|----------|--------------|---------------------|
| 1 | `mint(address to, uint256 amount)` | Mint new tokens (respects `maxSupply` and `archived`) | `msg.sender == executor \|\| isAuthorizedMinter[msg.sender]` |
| 2 | `burnFrom(address from, uint256 amount)` | Burn tokens from any address **without an allowance** | authorized minters & executor skip the allowance; everyone else needs approval |
| 3 | `batchSetCreditWhitelistAddresses(address[] accounts, bool[] allowed)` | Grant/revoke per-address mutual-credit eligibility | `msg.sender == executor \|\| owner() \|\| isAuthorizedMinter[msg.sender]` |

Authorized minters can be supplied at **token creation** (via the factory
`deploy*WithMinters(...)` entrypoints / the `_initialAuthorizedMinters` arg to
`initialize`) and managed afterward by the executor/owner via
`batchSetAuthorizedMinters(accounts, allowed)`.

> The set of current minters can be reconstructed off-chain from the
> `AuthorizedMinterUpdated(address indexed account, bool allowed)` event. The
> initial set is carried in the creation transaction's calldata.

### Why this matters for a backend

Because the check is purely `isAuthorizedMinter[msg.sender]`, a backend service
that **holds the private key of an authorized minter** can sign these three
transactions itself — there is no on-chain proposal/vote step to wait on. That
is the whole point of the feature and what this example demonstrates.

---

## How the example works

The script ([`authorized-minter-actions.ts`](./authorized-minter-actions.ts)) is
deliberately structured like the other interaction scripts in this folder (a
`CONFIGURATION` block at the top, a minimal ABI, then a `main()` that logs each
step). It:

1. Loads the authorized minter key from `AUTHORIZED_MINTER_PRIVATE_KEY` (falls
   back to `PRIVATE_KEY`) and connects to `RPC_URL`.
2. Connects to the token at `TOKEN_ADDRESS` and **sanity-checks** that
   `isAuthorizedMinter[wallet]` is `true` (or that the wallet is the executor),
   so you get a clear error instead of a raw `!executor` revert.
3. Runs each of the three actions (each one individually toggleable):
   - **Action 1 — `mint`**: mints `MINT_AMOUNT` to `MINT_TO`, logging the
     before/after balance.
   - **Action 2 — `burnFrom`**: burns `BURN_AMOUNT` from `BURN_FROM` (no
     allowance required for an authorized minter).
   - **Action 3 — `batchSetCreditWhitelistAddresses`**: grants/revokes
     mutual-credit eligibility for `CREDIT_WHITELIST_ACCOUNTS`.
4. Prints the resulting total supply.

Gas fees are pulled from the network and bumped by `GAS_PRICE_MULTIPLIER` to
avoid "transaction underpriced" failures (same approach as the upgrade scripts).

---

## Configuration

### Environment variables (`.env` in `packages/storage-evm`)

```bash
RPC_URL="https://base-mainnet.g.alchemy.com/v2/<your-key>"

# The key that was registered as an authorized minter at token creation.
# Keep this in a secret manager in production — it controls real mint/burn power.
AUTHORIZED_MINTER_PRIVATE_KEY="<authorized-minter-private-key>"
```

### In-script config (top of `authorized-minter-actions.ts`)

| Constant | Meaning |
|----------|---------|
| `TOKEN_ADDRESS` | The deployed space token to act on |
| `TOKEN_DECIMALS` | Token decimals (18 for these contracts) |
| `RUN_MINT` / `RUN_BURN` / `RUN_SET_CREDIT_WHITELIST` | Toggle each action |
| `MINT_TO`, `MINT_AMOUNT` | `mint` recipient + amount (human units) |
| `BURN_FROM`, `BURN_AMOUNT` | `burnFrom` target + amount (human units) |
| `CREDIT_WHITELIST_ACCOUNTS`, `CREDIT_WHITELIST_ALLOWED` | parallel arrays for `batchSetCreditWhitelistAddresses` |
| `GAS_PRICE_MULTIPLIER` | Fee bump (`150` = +50%) |

---

## Running it

```bash
cd packages/storage-evm

# with ts-node (like the other scripts in this folder)
ts-node scripts/base-mainnet-contracts-scripts/authorized-minter-actions.ts

# or through hardhat (uses the network's configured signer/RPC)
npx hardhat run scripts/base-mainnet-contracts-scripts/authorized-minter-actions.ts --network base
```

---

## Adapting it into a real backend service

The `main()` body is the reusable part. In a long-running service you would
typically:

- Instantiate the provider + wallet once at startup from secrets, not per call.
- Expose one function per action (e.g. `mintTo`, `burnFrom`, `setCreditWhitelist`)
  instead of the toggle flags.
- `await tx.wait()` (or poll for the receipt) and surface the tx hash to the
  caller; handle reverts (`!executor`, `supply exceeded`, `archived`) explicitly.
- Optionally pre-check `isAuthorizedMinter[wallet]` on boot and alert if the key
  was revoked via `batchSetAuthorizedMinters`.

```ts
const token = new ethers.Contract(TOKEN_ADDRESS, tokenAbi, wallet);

// 1. mint
await (await token.mint(to, ethers.parseUnits(amount, 18))).wait();

// 2. burnFrom (no allowance needed for an authorized minter)
await (await token.burnFrom(from, ethers.parseUnits(amount, 18))).wait();

// 3. batch credit whitelist
await (await token.batchSetCreditWhitelistAddresses(accounts, allowed)).wait();
```

---

## Security notes

- The authorized minter private key grants real on-chain power to **create and
  destroy token supply** and to change credit eligibility. Store it in a secret
  manager, never commit it, and scope it to the minimum surface that needs it.
- Prefer a dedicated key per backend/service so it can be revoked individually
  via `batchSetAuthorizedMinters([key], [false])` without affecting others.
- `mint` still enforces `maxSupply` and the `archived` flag; `burnFrom` cannot
  burn more than an address holds. These are contract-level guards, not reasons
  to relax key hygiene.
