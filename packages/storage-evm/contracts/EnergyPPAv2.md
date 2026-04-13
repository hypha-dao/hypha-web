# EnergyPPAv2 & EnergyPPAv2Factory

## What Is This?

**EnergyPPAv2** is a smart contract that handles energy billing and revenue sharing for a community. It:

1. **Charges consumers** for the energy they use (solar, battery, or grid import).
2. **Splits revenue** from each energy source to token holders proportionally.
3. **Lets members settle debt** by paying stablecoins, or **claim credit** as stablecoins.

Each energy source (e.g. a solar park) has its own ERC-20 ownership token (`RegularSpaceToken`). If you hold 30% of that token's supply, you get 30% of that source's revenue after fees.

**Export** to the grid uses a designated export device ID. When the backend sends a reading with the export device ID, revenue goes to the source's token holders and `gridBalance` increases (grid owes the community).

**EnergyPPAv2Factory** deploys a fully configured community in a single transaction — including the PPA contract, the EnergyToken, and all source ownership tokens.

---

## How It Works

```
Backend sends meter readings
         │
         ▼
   consumeEnergy(readings)
         │
         ├── Phase 1: Charge each consumer (quantity × price)
         │     • Local source → revenue accumulates per source
         │     • Grid import  → gridBalance decreases (community owes grid)
         │     • Export device → gridBalance increases (grid owes community)
         │
         └── Phase 2: Split each source's revenue
               • Community fee (e.g. 5%)
               • Aggregator fee (e.g. 3%)
               • Remainder → proportional to ownership token balances
               • Last holder gets the remainder (absorbs rounding dust)

After consumption, members can:
  • settleOwnDebt()  — pay stablecoins to reduce a negative balance
  • claimCredit()    — withdraw a positive balance as stablecoins
```

**Zero-sum invariant**: the sum of all member balances + fee balances − gridBalance + settledBalance always equals zero. Enforced automatically after every `consumeEnergy` call.

**Conversion rate**: 1 internal unit = 10,000 stablecoin units (e.g. if stablecoin has 6 decimals, 1 internal unit = 0.01 USDC).

**gridBalance**: a single value tracking the community's net position with the grid:
- **Negative** = community imported more than exported (owes the grid)
- **Positive** = community exported more than imported (grid owes the community)

**Pricing**:
- **Source base price** (`basePricePerKwh`) — agreed PPA price for local production, stored on-chain for transparency.
- **Import price** — NOT stored on-chain. The grid tariff is external; the backend decides.
- **Export price** — decided by the backend. The export device sends readings at the negotiated rate.

---

## EnergyPPAv2 — Functions

### Initialization

| Function | Access | What It Does |
|---|---|---|
| `initialize(initialOwner, energyToken, stablecoin, paymentRecipient)` | Once only | Sets up the contract. Called automatically by the UUPS proxy on deployment. Sets the owner, links the EnergyToken and stablecoin addresses. |

### Source Registry

| Function | Access | What It Does |
|---|---|---|
| `registerSource(sourceId, sourceType, ownershipToken, basePricePerKwh)` | Whitelisted | Adds a new energy source (solar, battery). Links it to an ERC-20 ownership token. `basePricePerKwh` is a reference price stored for transparency — the backend decides the actual price per reading. |
| `updateSourceBasePrice(sourceId, newBasePrice)` | Whitelisted | Updates the reference base price for a source. Informational only — doesn't change actual billing. |
| `deactivateSource(sourceId)` | Whitelisted | Disables a source. It can no longer receive consumption readings. |

### Core

| Function | Access | What It Does |
|---|---|---|
| `consumeEnergy(readings[])` | Whitelisted | The main function. Takes an array of meter readings, charges each consumer, and distributes revenue to source owners. Each reading has: `deviceId`, `quantity`, `pricePerKwh`, `sourceId`. All devices — households, export buyers, etc. — are treated identically. Automatically enforces the zero-sum invariant. |

### Members

| Function | Access | What It Does |
|---|---|---|
| `addMember(address, deviceIds[], metadataHash)` | Whitelisted | Registers a community member. `deviceIds` links their smart meter(s) to their address. Pass empty `deviceIds` for pure investors (no meter, just revenue). External buyers (other communities) are added as regular members with devices. |
| `removeMember(address)` | Whitelisted | Removes a member. Unlinks their devices, clears their balance, burns any EnergyToken they hold. |

### Export

| Function | Access | What It Does |
|---|---|---|
| `setExportDeviceId(deviceId)` | Whitelisted | Set the device ID used for grid export. When a reading targets this device, revenue goes to source owners and gridBalance increases. |
| `getExportDeviceId()` | View | Returns the current export device ID. |

### Settlement (Paying Debt)

| Function | Access | What It Does |
|---|---|---|
| `settleOwnDebt(stablecoinAmount)` | Anyone (own debt) | Pay off your negative energy credit balance using stablecoins. If you overpay, it's capped to your actual debt. Stablecoins are held by the contract as liquidity for credit claims. |
| `settleDebt(debtor, stablecoinAmount)` | Anyone | Pay off someone else's debt. Same logic as `settleOwnDebt` but you specify the debtor address. |

### Credit Claiming (Withdrawing Earnings)

| Function | Access | What It Does |
|---|---|---|
| `claimCredit(internalAmount)` | Anyone (own credit) | Withdraw your positive energy credit balance as stablecoins. If you request more than your credit, it's capped. Requires the contract to hold sufficient stablecoin liquidity. |
| `claimCreditFor(beneficiary, internalAmount)` | Whitelisted | Trigger a credit payout to any member. Useful for automated payouts. |

### Admin — Owner Only

| Function | Access | What It Does |
|---|---|---|
| `updateWhitelist(account, bool)` | Owner | Grant or revoke whitelist access for an address. Whitelisted addresses can call `consumeEnergy`, `registerSource`, `addMember`, etc. |
| `setCommunityAddress(addr)` | Owner | Set the address that receives community fees. |
| `setAggregatorAddress(addr)` | Owner | Set the address that receives aggregator fees. |
| `setCommunityFeeBps(bps)` | Owner | Set community fee in basis points (500 = 5%). Total fees cannot exceed 100%. |
| `setAggregatorFeeBps(bps)` | Owner | Set aggregator fee in basis points (300 = 3%). |
| `setPaymentRecipient(recipient)` | Owner | Set the payment recipient address (currently unused — stablecoins stay in contract). |

### Admin — Whitelisted

| Function | Access | What It Does |
|---|---|---|
| `setEnergyToken(address)` | Whitelisted | Change the EnergyToken contract address. |
| `setStablecoin(address)` | Whitelisted | Change the stablecoin contract address. |
| `emergencyReset()` | Whitelisted | Zeroes all balances for all members, fees, import, and settled. Use only in emergencies. |

### View Functions (Read-Only)

| Function | What It Returns |
|---|---|
| `getSourceIds()` | Array of all registered source IDs. |
| `getSource(sourceId)` | Source details: type, ownership token address, base price, active status. |
| `getSourceOwnershipBps(sourceId, member)` | How many basis points (out of 10000) a member owns of a specific source. |
| `getAllSourceOwnerships(member)` | For each source, returns the member's ownership bps. |
| `getMember(address)` | Member details: address, device IDs, active status, metadata hash. |
| `getMemberAddresses()` | Array of all member addresses. |
| `getEnergyCreditBalance(account)` | The member's energy credit balance. Positive = credit (earned revenue), negative = debt (owes for consumption). |
| `getTokenBalance(account)` | The member's EnergyToken balance (represents positive credit as an ERC-20). |
| `getDebtInStablecoin(debtor)` | The member's debt converted to stablecoin units. Returns 0 if no debt. |
| `getCreditInStablecoin(account)` | The member's credit converted to stablecoin units. Returns 0 if no credit. |
| `getContractStablecoinBalance()` | How many stablecoins the contract currently holds (from debt settlements). |
| `verifyZeroSum()` | Returns `(true, 0)` if all balances sum to zero. Useful for external auditing. |
| `getDeviceOwner(deviceId)` | Which member address owns a specific device. |
| `getGridBalance()` | Net grid position: negative = community imported more (owes grid), positive = community exported more (grid owes community). |
| `getSettledBalance()` | Net stablecoin settlement tracking (negative = stablecoins received by contract). |
| `getEnergyTokenAddress()` | Address of the EnergyToken contract. |
| `isAddressWhitelisted(account)` | Whether an address is whitelisted. |
| `getCommunityFeeBps()` | Current community fee in basis points. |
| `getAggregatorFeeBps()` | Current aggregator fee in basis points. |
| `getExportDeviceId()` | The device ID designated for grid export. |

---

## EnergyPPAv2Factory — Functions

The factory deploys a complete community in one transaction. It creates:
- An **EnergyToken** (ERC-20 for positive credit balances)
- A **UUPS proxy** for the EnergyPPAv2 contract
- A **RegularSpaceToken proxy** per energy source (ownership tokens)
- Mints and distributes ownership tokens to initial holders
- Registers all sources, adds all members, sets fees, sets export device ID

After deployment, the factory transfers all ownership to the `admin` address and removes itself from the whitelist.

### Constructor

| Parameter | What It Is |
|---|---|
| `_energyPPAImplementation` | Address of the deployed EnergyPPAv2 implementation (shared by all proxies). |
| `_regularSpaceTokenImplementation` | Address of the deployed RegularSpaceToken implementation (shared by all source token proxies). |

### Functions

| Function | Access | What It Does |
|---|---|---|
| `deployCommunity(params)` | Anyone | Deploys a complete community. See parameter details below. Returns `communityId` and `proxy` address. |
| `setImplementation(newImpl)` | Owner | Update the EnergyPPAv2 implementation used for future deployments. Does not affect existing communities. |
| `setRegularSpaceTokenImplementation(newImpl)` | Owner | Update the RegularSpaceToken implementation for future deployments. |
| `getCommunityCount()` | Anyone | Number of communities deployed through this factory. |
| `getAdminCommunities(admin)` | Anyone | Array of community IDs managed by a specific admin. |
| `communities(index)` | Anyone | Returns a community record: proxy address, energy token address, admin, deployment timestamp. |

### deployCommunity Parameters

The `CommunityParams` struct:

| Field | Type | What It Is |
|---|---|---|
| `admin` | address | Who will own the deployed PPA (receives ownership + whitelist access). |
| `stablecoin` | address | ERC-20 stablecoin used for debt settlement and credit claims (e.g. USDC). |
| `communityAddress` | address | Address that receives community fees. |
| `aggregatorAddress` | address | Address that receives aggregator fees. |
| `communityFeeBps` | uint16 | Community fee in basis points (500 = 5%). |
| `aggregatorFeeBps` | uint16 | Aggregator fee in basis points (300 = 3%). |
| `energyTokenName` | string | Name for the EnergyToken (e.g. "Community Energy"). |
| `energyTokenSymbol` | string | Symbol for the EnergyToken (e.g. "CET"). |
| `sources` | SourceConfig[] | Array of energy sources to register (see below). |
| `members` | MemberConfig[] | Array of members to register (see below). |
| `exportDeviceId` | uint256 | Device ID for grid export. Set to 0 to disable export. |

Each `SourceConfig`:

| Field | Type | What It Is |
|---|---|---|
| `sourceId` | bytes32 | Unique identifier for this source (e.g. `keccak256("SOLAR_PARK_A")`). |
| `sourceType` | SourceType | `0` = SOLAR, `1` = BATTERY. |
| `tokenName` | string | Name for the ownership token (e.g. "Solar Park A"). |
| `tokenSymbol` | string | Symbol (e.g. "SOLAR-A"). |
| `basePricePerKwh` | uint256 | Reference PPA price per kWh (what members charge each other for local production). |
| `holders` | address[] | Addresses that will receive ownership tokens. |
| `holderAmounts` | uint256[] | How many tokens each holder gets. The sum becomes the total supply. |

Each `MemberConfig`:

| Field | Type | What It Is |
|---|---|---|
| `memberAddress` | address | Member's wallet address. |
| `deviceIds` | uint256[] | Their smart meter device IDs. Empty for pure investors. |
| `metadataHash` | bytes32 | Optional metadata hash (e.g. IPFS hash of member details). |

### Deployment Flow (What Happens Inside)

1. Deploy `EnergyToken` with factory as temporary owner
2. Deploy `EnergyPPAv2` UUPS proxy with factory as temporary owner
3. Authorize PPA on EnergyToken, transfer EnergyToken ownership to admin
4. Whitelist factory on PPA (temporary, for setup)
5. For each source: deploy a `RegularSpaceToken` UUPS proxy, mint tokens to holders
6. Register each source on PPA
7. Add all members
8. Set fees, community/aggregator addresses
9. Set export device ID if non-zero
10. Whitelist admin, remove factory from whitelist, transfer PPA ownership to admin
11. Record the deployment and emit `CommunityDeployed` event

### Ownership After Deployment

| Contract | Owner | Executor | Controller |
|---|---|---|---|
| EnergyPPAv2 (proxy) | `admin` | N/A (uses owner + whitelist) | `admin` |
| EnergyToken | `admin` | N/A (uses `authorized` mapping) | `admin` |
| RegularSpaceToken (per source) | Hardcoded in contract | Factory address | Factory (can be transferred later via `setExecutor` after upgrade) |

The factory retains no authority over the PPA or EnergyToken after deployment. For source ownership tokens, the factory is the `executor` until a `RegularSpaceToken` upgrade adds `setExecutor` — at which point the executor can be transferred to the space treasury.

---

## Batching for Large Communities

`consumeEnergy` gas cost scales as: `O(readings) + O(sources × members)`.

For large communities (100+ members), a single call may exceed the 30M gas block limit on Base. Split readings into multiple `consumeEnergy` calls:

```
// Instead of one call with 200 readings:
consumeEnergy(allReadings)  // might exceed gas limit

// Split into batches:
consumeEnergy(readings[0..99])
consumeEnergy(readings[100..199])
```

Each call independently charges consumers and distributes revenue. The zero-sum invariant is maintained per call.
