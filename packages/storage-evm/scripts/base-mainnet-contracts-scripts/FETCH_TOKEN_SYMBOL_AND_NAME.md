# Fetch Token Symbol and Name

A beginner-friendly guide to `fetch-token-symbol-and-name.ts` — a small script that reads a
token's name, symbol, and decimals directly from the blockchain.

## What "fetching onchain data" means

A smart contract (like an ERC20 token) lives at an **address** on a blockchain. It stores data and
exposes **functions** you can call. Some functions only *read* data and cost no gas and require no
wallet/private key — these are called `view` functions. `name()`, `symbol()`, and `decimals()` are
exactly these kinds of read-only functions.

To read them you need three things:

1. **An RPC URL** — the "phone line" to a blockchain node. You send your request here and it
   answers. (We use Base Mainnet in this repo.)
2. **The contract address** — *which* token you want to ask.
3. **The ABI** — a description of what functions exist and what they return, so the library knows
   how to encode your question and decode the answer.

## The three building blocks in the code

```typescript
// 1. The provider = your connection to the blockchain (read-only)
const provider = new ethers.JsonRpcProvider(process.env.RPC_URL);

// 2. The contract = address + ABI + provider, bundled so you can call its functions
const token = new ethers.Contract(tokenAddress, tokenAbi, provider);

// 3. Calling the view functions (they return Promises, so we await them)
const [name, symbol, decimals] = await Promise.all([
  token.name(),
  token.symbol(),
  token.decimals(),
]);
```

`Promise.all` just runs the three reads at the same time instead of one after another — faster, same
result.

### What is the ABI here?

The ABI in this script is a tiny JSON list describing only the three functions we use. Each entry
says: the function takes no `inputs`, is `view` (read-only), and returns a `string` (for `name`/
`symbol`) or a `uint8` (for `decimals`). You don't need the token's full ABI — only the parts you
call.

### Why convert `decimals`?

Numbers from the chain come back as `BigInt`. `decimals` is small, so we turn it into a normal
number with `Number(decimals)` for easy printing.

## How to run it

You need `RPC_URL` set in a `.env` file in `packages/storage-evm` (Base Mainnet RPC endpoint).

```bash
# Pass the token address with a flag
npx tsx fetch-token-symbol-and-name.ts --token 0xYourTokenAddress

# Or as a plain argument
npx tsx fetch-token-symbol-and-name.ts 0xYourTokenAddress

# Or via an environment variable
TOKEN_ADDRESS=0xYourTokenAddress npx tsx fetch-token-symbol-and-name.ts

# See all options
npx tsx fetch-token-symbol-and-name.ts --help
```

Example output:

```
=== Token: Hypha Token (HYPHA) ===
Address: 0xYourTokenAddress
Name: Hypha Token
Symbol: HYPHA
Decimals: 18
===============
```

## Common errors

- **`Missing required environment variable: RPC_URL`** — add `RPC_URL` to your `.env`.
- **`Invalid token address`** — the address is malformed (must be a valid `0x...` address).
- **`could not decode result data`** — the address isn't an ERC20 token, or it doesn't implement
  these functions.

## Where to go next

Once you understand reading `view` functions, the next steps are: reading functions that take
arguments (e.g. `balanceOf(address)`), and *writing* to the chain (which needs a wallet, a private
key, and costs gas). See the other scripts in this folder for those patterns.
