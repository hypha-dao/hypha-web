# Seeds Example Contracts - Solidity Version

This folder contains Solidity (EVM) implementations of the Seeds/Rainbows token ecosystem, originally written in C++ for EOSIO/Antelope blockchains.

> **Reference code — not deployed.** None of these contracts have deployment addresses in
> `contracts/addresses.txt`, and they are excluded from `wagmi.config.ts`, so they generate no
> bindings in `packages/core/src/generated.ts`. `OSwaps.sol` has a deploy script
> (`scripts/oswaps.deploy.ts`) and a test suite (`test/OSwaps.test.ts`); the Rainbow contracts have
> neither. Nothing here has been audited.

## Further documentation on OSwaps

- **[`OSwaps.docs.md`](./OSwaps.docs.md)** — complete contract reference: full external surface,
  role model, bootstrap sequence, pricing math with measured accuracy bounds, revert catalogue, and
  the constraints a UI has to handle. Written for implementing a UI against the contract.
- **[`OSwaps.EOSIO-PARITY.md`](./OSwaps.EOSIO-PARITY.md)** — how faithfully the Solidity port
  reproduces the original Antelope/EOSIO protocol, action by action, including where it diverges and
  why.

## Contracts

### 1. OSwaps.sol

A decentralized token swap protocol implementing a multi-token liquidity pool using the Balancer invariant formula.

**Features:**

- Multi-token liquidity pools
- Balancer invariant: `V = B1^W1 * B2^W2 * ... * Bn^Wn`
- Single-sided liquidity provision with dynamic weight adjustment
- Swap with exact input or exact output amount
- Liquidity receipt tokens (LIQ tokens)
- Freezing/unfreezing of individual tokens

**Key Functions:**

- `createAsset()` - Register a token in the pool
- `addLiquidity()` - Add liquidity and receive LIQ tokens
- `withdraw()` - Withdraw liquidity by burning LIQ tokens (manager only)
- `swapExactIn()` - Swap with known input amount, with a `minOutAmount` slippage floor
- `swapExactOut()` - Swap with known output amount, with a `maxInAmount` cap
- `quoteExactIn()` / `quoteExactOut()` - Price a swap without executing it
- `queryPool()` - Get pool status for tokens
- `getTokenIds()` / `getAsset()` - Enumerate and read registered assets
- `setManager()` - Hand the manager role to a replacement (manager only)

See [`OSwaps.docs.md`](./OSwaps.docs.md) for the full surface. Note the bootstrap sequence: a new
asset needs `createAsset` → `unfreeze` → `addLiquidity` with a non-zero weight → `unfreeze` again
before it can be swapped.

### 2. RainbowToken.sol

An advanced ERC20 token with backing, demurrage, membership requirements, and credit features.

**Features:**

- Token backing (tokens backed by other tokens in escrow)
- Demurrage (time-based decay) and wealth taxation
- Membership restrictions (requires membership token)
- Credit limits (allows negative balances up to a limit)
- Positive limits (maximum balance caps)
- Proportional or fixed-ratio backing redemption
- Valuation tracking against reference currencies
- Freezable transfers
- Approval system for token creation

**Key Functions:**

- `issue()` - Mint new tokens (issuer only)
- `retire()` - Burn tokens with optional backing redemption
- `transfer()` - Transfer with credit/membership checks
- `garner()` - Apply demurrage/wealth tax
- `addBacking()` - Add backing relationship
- `removeBacking()` - Remove backing relationship
- `setValuation()` - Set token valuation

### 3. RainbowFactory.sol

Factory contract for deploying new RainbowToken instances.

**Features:**

- Deploy new Rainbow tokens
- Track all deployed tokens
- Lookup tokens by symbol

## Key Differences from EOSIO Version

### Architecture Changes

1. **Transaction Model**

   - **EOSIO**: Uses compound transactions with "prep" actions followed by token transfers
   - **Solidity**: Direct function calls with reentrancy protection

2. **Table Storage → Mappings**

   - **EOSIO**: Multi-index tables scoped by account/symbol
   - **Solidity**: Mappings and arrays for state storage

3. **Authorization**

   - **EOSIO**: `require_auth()` checks with named permissions
   - **Solidity**: `msg.sender` checks with modifiers

4. **Token Standard**
   - **EOSIO**: Custom token implementation
   - **Solidity**: ERC20-compatible with extensions

### Feature Adaptations

#### OSwaps

- Removed chain ID validation (EVM is single-chain)
- Simplified transaction validation (no "prep + transfer" pattern)
- Direct token transfers using the ERC20 standard, via `SafeERC20`
- Fixed-point `pow` in place of the original's `log()`/`exp()` on doubles
- Slippage protection and reentrancy guards, which a public mempool makes necessary
- Fee-on-transfer and rebasing tokens rejected rather than mispriced

#### RainbowToken

- Credit system using signed integers (`int256` balances)
- Backing requires escrow to approve contract (or use escrow pattern)
- Membership checks via token balances
- Removed multi-chain family concepts
- Simplified sister token references

### Mathematical Implementations

The Balancer invariant needs a fractional power, which the original computed as
`exp(y * log(x))` using the C standard library on IEEE doubles. OSwaps evaluates the same expression
with [PRBMath](https://github.com/PaulRBerg/prb-math)'s `UD60x18.pow` in 18-decimal fixed point:

```solidity
UD60x18 ratio  = ud(inBalAfter).div(ud(inBalBefore));
UD60x18 factor = ratio.pow(ud(wIn).div(ud(wOut)));
```

Each formula is rearranged so the base always exceeds one and the exponent is always positive, which
keeps every intermediate value unsigned. Measured relative error is below 1e-10 across trade sizes
from a millionth of the pool balance up to a hundred times it, and truncation is biased so leftover
wei stay in the pool. See [`OSwaps.docs.md`](./OSwaps.docs.md) §6 for the measured bounds and the
one domain limit that remains (extreme weight ratios cap the trade size).

## Usage Examples

### OSwaps Usage

```solidity
// 1. Create pool assets
uint64 token1Id = oswaps.createAsset(
    address(token1),
    "TOKEN1",
    "metadata"
);

// 2. Approve tokens
token1.approve(address(oswaps), amount);

// 3. Add liquidity — the asset must be unfrozen first, and the initial
//    weight must be non-zero, which freezes it again pending manager review
oswaps.addLiquidity(token1Id, amount, initialWeight);

// 4. Quote, then swap with a slippage floor derived from the quote
uint256 expected = oswaps.quoteExactIn(inputTokenId, outputTokenId, inputAmount);
oswaps.swapExactIn(
    recipient,
    inputTokenId,
    outputTokenId,
    inputAmount,
    (expected * 995) / 1000 // 0.5% tolerance
);
```

### RainbowToken Usage

```solidity
// 1. Deploy via factory
address tokenAddr = factory.createToken(
    "My Rainbow Token",
    "RAIN",
    issuer,
    maxSupply,
    withdrawalMgr,
    withdrawTo,
    freezeMgr,
    redeemLockTime,
    configLockTime
);

// 2. Approve token
RainbowToken token = RainbowToken(tokenAddr);
token.approve(true);

// 3. Add backing
backingToken.approve(address(token), backingAmount);
token.addBacking(
    tokenBucket,
    backsPerBucket,
    address(backingToken),
    escrowAddress,
    false, // proportional
    80 // 80% reserve fraction
);

// 4. Issue tokens
token.issue(amount);

// 5. Transfer
token.transfer(recipient, amount);

// 6. Retire with redemption
token.retire(amount, true);
```

## Security Considerations

1. **Reentrancy Protection**: Both contracts use OpenZeppelin's `ReentrancyGuard`
2. **Access Control**: Role-based access using modifiers
3. **Integer Overflow**: Solidity 0.8+ has built-in overflow protection
4. **Backing Escrow**: Escrow accounts must approve the token contract for redemption
5. **Mathematical Precision**: OSwaps delegates its fractional powers to PRBMath; residual error is
   below 1e-10 relative and has no guaranteed sign, so per-swap invariant drift is bounded rather
   than eliminated (measured below 1e-12 of pool value)
6. **Single point of control**: every OSwaps operational power sits with one `manager` address, and
   liquidity providers cannot exit without it. Deploy the manager as a multisig or space `Executor`,
   never an EOA
7. **Unaudited**: none of these contracts has had a third-party review

## Testing

`test/OSwaps.test.ts` covers OSwaps with 85 cases: the full external surface and access-control
matrix, the bootstrap and retirement sequences, weight rescaling, LIQ receipt behaviour, reentrancy
and misbehaving-token handling, and a pricing-math section that checks accuracy against a
double-precision reference, invariant preservation, exact-in/exact-out duality, and the domain limit.

Run it with:

```bash
cd packages/storage-evm && npx hardhat test test/OSwaps.test.ts
```

**No tests exist for the Rainbow contracts.** The following are recommended scenarios still to be
written, not a record of coverage.

### RainbowToken

- Token creation and approval
- Backing operations (add/remove)
- Issue and retire with backing
- Credit limits (negative balances)
- Positive limits
- Membership restrictions
- Demurrage calculations
- Valuation tracking

## Original Contracts

The original EOSIO contracts can be found in:

- `oswaps.cpp` / `oswaps.hpp` - Swap protocol
- `seedstoken.cpp` / `seedstoken.hpp` - Rainbow token (contract name: "rainbows")

## License

MIT License

## Credits

Original design and implementation by the Seeds/Hypha team for EOSIO/Antelope blockchains.
Solidity adaptation for EVM compatibility.
