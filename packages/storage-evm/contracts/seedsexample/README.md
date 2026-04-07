# Seeds Example Contracts - Solidity Version

This folder contains Solidity (EVM) implementations of the Seeds/Rainbows token ecosystem, originally written in C++ for EOSIO/Antelope blockchains.

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
- `withdraw()` - Withdraw liquidity by burning LIQ tokens
- `swapExactIn()` - Swap with known input amount
- `swapExactOut()` - Swap with known output amount
- `queryPool()` - Get pool status for tokens

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
- Direct token transfers using ERC20 standard
- Natural logarithm approximation for gas efficiency

#### RainbowToken

- Credit system using signed integers (`int256` balances)
- Backing requires escrow to approve contract (or use escrow pattern)
- Membership checks via token balances
- Removed multi-chain family concepts
- Simplified sister token references

### Mathematical Implementations

Both contracts use approximations for mathematical operations:

**Natural Logarithm (ln)**

```solidity
// Taylor series: ln(x) ≈ (x-1) - (x-1)²/2 + (x-1)³/3 - ...
```

**Exponential (e^x)**

```solidity
// Taylor series: e^x = 1 + x + x²/2! + x³/3! + ...
```

These provide reasonable accuracy for typical swap amounts while remaining gas-efficient.

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

// 3. Add liquidity
oswaps.addLiquidity(token1Id, amount, initialWeight);

// 4. Perform swap
oswaps.swapExactIn(
    recipient,
    inputTokenId,
    outputTokenId,
    inputAmount
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
5. **Mathematical Precision**: Taylor series approximations have limited precision for extreme values

## Testing

Recommended test scenarios:

### OSwaps

- ✓ Create assets and add liquidity
- ✓ Single-sided liquidity additions
- ✓ Swaps with exact input/output
- ✓ Weight adjustments
- ✓ Freeze/unfreeze functionality
- ✓ Mathematical accuracy of Balancer formula

### RainbowToken

- ✓ Token creation and approval
- ✓ Backing operations (add/remove)
- ✓ Issue and retire with backing
- ✓ Credit limits (negative balances)
- ✓ Positive limits
- ✓ Membership restrictions
- ✓ Demurrage calculations
- ✓ Valuation tracking

## Original Contracts

The original EOSIO contracts can be found in:

- `oswaps.cpp` / `oswaps.hpp` - Swap protocol
- `seedstoken.cpp` / `seedstoken.hpp` - Rainbow token (contract name: "rainbows")

## License

MIT License

## Credits

Original design and implementation by the Seeds/Hypha team for EOSIO/Antelope blockchains.
Solidity adaptation for EVM compatibility.
