# Unified SpaceToken — Extension-Based Architecture

## Architecture Overview

```
SpaceToken (18.8 KiB) — thin base
│   ERC20 + whitelists + pricing + archiving + naming + ownership
│   Extension hooks in transfer/mint pipeline
│   extensionMint / extensionBurn callbacks for extensions
│
├── DecayExtension (3.3 KiB) — separate contract, own storage
│   Stores: decayPercentage, decayRate, lastApplied[], tokenHolders[]
│   Modifies balanceOf via adjustedBalanceOf hook
│   Materializes decay by calling token.extensionBurn()
│
├── MutualCreditExtension (5.2 KiB) — separate contract, own storage
│   Stores: creditBalanceOf[], creditLimits[], whitelistedSpaces[]
│   Mints credit via token.extensionMint()
│   Auto-repays via token.extensionBurn()
│
└── (future extensions: deploy new contract, attach to any token)
```

Each token gets its own extension instances (EIP-1167 clones) with independent storage.
Extensions can be added/removed by the executor after deployment.

---

## Deployment Guide

### Step 1: Deploy libraries and extension implementations (once)

```typescript
// DecayLib — external library used by DecayExtension
const DecayLib = await ethers.getContractFactory('DecayLib');
const decayLib = await DecayLib.deploy();

// DecayExtension implementation (linked to DecayLib)
const DecayExtension = await ethers.getContractFactory('DecayExtension', {
  libraries: { DecayLib: await decayLib.getAddress() },
});
const decayExtImpl = await DecayExtension.deploy();

// MutualCreditExtension implementation
const MutualCreditExtension = await ethers.getContractFactory('MutualCreditExtension');
const creditExtImpl = await MutualCreditExtension.deploy();
```

### Step 2: Deploy SpaceToken implementation (once)

```typescript
// No library linking needed — the token is clean
const SpaceToken = await ethers.getContractFactory('contracts/SpaceToken.sol:SpaceToken');
const spaceTokenImpl = await SpaceToken.deploy();
```

> Use fully qualified name `'contracts/SpaceToken.sol:SpaceToken'` due to name collision with DAOSpaceFactoryStorage.

### Step 3: Deploy SpaceTokenFactory (once)

```typescript
const SpaceTokenFactory = await ethers.getContractFactory('SpaceTokenFactory');
const factory = await upgrades.deployProxy(SpaceTokenFactory, [ownerAddress], {
  initializer: 'initialize', kind: 'uups',
});
await factory.setSpacesContract(daoSpaceFactoryAddress);
await factory.setSpaceTokenImplementation(await spaceTokenImpl.getAddress());
await factory.setDecayExtensionImplementation(await decayExtImpl.getAddress());
await factory.setMutualCreditExtensionImplementation(await creditExtImpl.getAddress());
```

### Step 4: Deploy tokens (per space, via executor)

The factory handles everything — cloning extensions, linking them, deploying the token proxy.

---

## Frontend Integration

### Deploying a Token

```typescript
const baseConfig = {
  name: 'My Token',
  symbol: 'MTK',
  executor: ethers.ZeroAddress,       // overridden by factory
  spaceId: 0n,                        // overridden by factory
  spacesContract: ethers.ZeroAddress,  // overridden by factory
  maxSupply: 0n,
  transferable: true,
  fixedMaxSupply: false,
  autoMinting: false,
  tokenPrice: 1000000n,               // $1.00
  priceCurrencyFeed: ethers.ZeroAddress,
  useTransferWhitelist: false,
  useReceiveWhitelist: false,
  initialTransferWhitelist: [],
  initialReceiveWhitelist: [],
  ownershipRestricted: false,
  escrowContract: ethers.ZeroAddress,
};

const featureConfig = {
  decayEnabled: false,
  decayPercentage: 0n,
  decayInterval: 0n,
  mutualCreditEnabled: false,
  defaultCreditLimit: 0n,
  initialCreditWhitelistSpaceIds: [],
  ownershipRestricted: false,
  escrowContract: ethers.ZeroAddress,
};

const tx = await factory.connect(executor).deployToken(spaceId, baseConfig, featureConfig);
```

### Common Configurations

**Regular token**: all features disabled (defaults above)

**Decaying token**:
```typescript
featureConfig.decayEnabled = true;
featureConfig.decayPercentage = 100n;   // 1% per period
featureConfig.decayInterval = 604800n;  // 1 week
```

**Mutual credit token**:
```typescript
featureConfig.mutualCreditEnabled = true;
featureConfig.defaultCreditLimit = ethers.parseEther('1000');
featureConfig.initialCreditWhitelistSpaceIds = [otherSpaceId];
```

**Ownership token**:
```typescript
featureConfig.ownershipRestricted = true;
featureConfig.escrowContract = '0x447A...';
```

**Decaying + mutual credit** (NEW — not possible before):
```typescript
featureConfig.decayEnabled = true;
featureConfig.decayPercentage = 100n;
featureConfig.decayInterval = 604800n;
featureConfig.mutualCreditEnabled = true;
featureConfig.defaultCreditLimit = ethers.parseEther('500');
```

### Discovering Extensions

```typescript
const token = new ethers.Contract(tokenAddress, SpaceTokenABI, provider);

// Get all extension addresses
const extensions = await token.getExtensions();

// Check if a specific extension is registered
await token.isExtension(extensionAddress);

// Get the balance-of modifier (decay extension, if any)
const balModifier = await token.balanceOfModifier();
```

### Interacting with Extensions

Extensions are separate contracts. The frontend queries them directly:

```typescript
// Decay extension
const decay = new ethers.Contract(extensions[0], DecayExtensionABI, provider);
await decay.decayPercentage();
await decay.decayRate();
await decay.getDecayedTotalSupply();
await decay.applyDecay(userAddress);                        // tx
await decay.connect(executor).resetTimestamps();             // tx (unarchive)

// Mutual credit extension
const credit = new ethers.Contract(extensions[1], MutualCreditExtensionABI, provider);
await credit.creditBalanceOf(userAddress);
await credit.creditLimitOf(userAddress);
await credit.creditLimitLeftOf(userAddress);
await credit.netBalanceOf(userAddress);
await credit.getCreditWhitelistedSpaces();
await credit.connect(executor).setCreditLimit(user, amount);              // tx
await credit.connect(executor).removeCreditLimit(user);                   // tx
await credit.connect(executor).setDefaultCreditLimit(amount);             // tx
await credit.connect(executor).forgiveCredit(user, amount);               // tx
await credit.connect(executor).batchAddCreditWhitelistSpaces([spaceId]);  // tx
```

### Token base operations (unchanged)

```typescript
await token.balanceOf(user);          // adjusted by decay extension if present
await token.rawBalanceOf(user);       // raw ERC20 balance (no decay adjustment)
await token.totalSupply();
await token.tokenPrice();
await token.name();
await token.symbol();

// Executor admin
await token.connect(executor).mint(user, amount);
await token.connect(executor).setTransferable(true);
await token.connect(executor).setArchived(false);
await token.connect(executor).setPriceInUSD(newPrice);
await token.connect(executor).batchSetTransferWhitelist([addr], [true]);
// etc.
```

### Adding/Removing Extensions After Deployment

```typescript
// Deploy a new extension instance
const MutualCreditExtension = new ethers.ContractFactory(abi, bytecode, executor);
const newCredit = await MutualCreditExtension.deploy();
await newCredit.initialize(ethers.parseEther('500'), []);
await newCredit.setToken(tokenAddress);

// Register it with the token
await token.connect(executor).addExtension(await newCredit.getAddress());

// Remove an extension
await token.connect(executor).removeExtension(extensionAddress);
```

---

## Contract Sizes

| Contract | Size (KiB) | Limit | Headroom |
|----------|-----------|-------|----------|
| SpaceToken | 18.8 | 24.6 | 5.8 KiB |
| DecayExtension | 3.3 | 24.6 | 21.3 KiB |
| MutualCreditExtension | 5.2 | 24.6 | 19.4 KiB |
| DecayLib | 0.3 | — | (linked library) |
| SpaceTokenFactory | 7.3 | 24.6 | 17.3 KiB |

## Existing Contracts — No Changes Needed

| Contract | Why it works |
|----------|-------------|
| **TokenVotingPowerImplementation** | Uses `IERC20.balanceOf()` — SpaceToken is ERC20 |
| **VoteDecayTokenVotingPowerImplementation** | Decay extension exposes `decayPercentage()`, `applyDecay()`, `getDecayedTotalSupply()` at its own address |
| **OwnershipTokenVotingPowerImplementation** | Uses `balanceOf()` and `totalSupply()` |
| **TokenBackingVaultImplementation** | Uses `burnFrom()`, `tokenPrice()`, `priceCurrencyFeed()` |
| **Old tokens** (RegularSpaceToken, DecayingSpaceToken, etc.) | Stay deployed, unchanged, fully functional |
