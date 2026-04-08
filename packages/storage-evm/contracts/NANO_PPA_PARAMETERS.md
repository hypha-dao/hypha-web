# Nano PPA Parameters for EMS (On-Chain Design Guide)

## Purpose

This document defines what you should know about each household to create a Nano PPA (Power Purchase Agreement) in your energy community and which parameters are typically used in practice.

It is written for your current EMS design where:
- Physical delivery eligibility is tied to `memberAddress + deviceIds`
- Financial distribution is handled by `EnergyDistributionImplementation`
- Settlement is done with stablecoin via a separate settlement contract

---

## What You Need Per Household (Data Model)

Use these categories when onboarding a household into a Nano PPA.

### 1) Identity and Parties

Mandatory:
- `householdWallet`: on-chain beneficiary/payer address
- `ppaSignerId`: legal signer reference (off-chain KYC/contract system ID)
- `role`: owner-consumer, consumer-only, investor-only, or mixed

Optional:
- `delegateWallet`: secondary wallet allowed to trigger certain actions
- `operatorId`: installer/operator entity reference

Why: on-chain address is not enough for legal enforceability; you need an off-chain legal identity link.

### 2) Metering and Device Topology

Mandatory:
- `deliveryDeviceIds[]`: meter/device IDs mapped to the household
- `measurementIntervalSec`: cadence (for example 900 sec or 3600 sec)
- `timezone`: used for tariff windows and billing cutoffs
- `dataSource`: trusted telemetry source identifier (backend/oracle)

Optional:
- `submeterIds[]`: separate loads (EV charger, heat pump, etc.)
- `exportEligible`: whether household can receive export compensation
- `lossFactorBps`: technical loss adjustment for feeder/metering chain

Why: your contract uses `deviceId -> memberAddress`, so device integrity is critical for settlement correctness.

### 3) Contract Term and Lifecycle

Mandatory:
- `startTs`
- `endTs` (or evergreen with renewal rule)
- `billingCycleSec` (monthly is common)
- `status`: draft, active, suspended, terminated, expired

Optional:
- `autoRenew`: bool
- `noticePeriodDays`: termination notice
- `gracePeriodDays`: payment cure period

Why: Nano PPA needs explicit enforceable delivery windows and settlement periods.

### 4) Pricing and Tariff Rules

Mandatory:
- `tariffType`: fixed, indexed, time-of-use (TOU), or hybrid
- `basePriceMicrosPerKwh`: contracted energy price
- `currency`: EUR, USD, etc.
- `priceDecimals`: precision basis for calculations

Optional:
- `escalatorBpsPerYear`: annual escalation/de-escalation
- `touScheduleHash`: hash/pointer to TOU schedule stored off-chain
- `floorPriceMicrosPerKwh` and `capPriceMicrosPerKwh`
- `discountBpsVsRetail`: if defined against utility reference tariff

Why: price terms are the commercial core of the PPA and drive value allocation and debt.

### 5) Volume and Delivery Commitments

Mandatory:
- `contractedVolumeKwhPerPeriod` OR explicit `asAvailable` flag
- `settlementMode`: pay-as-consumed, take-or-pay, or minimum-offtake

Optional:
- `minOfftakeKwhPerPeriod`
- `maxTakeKwhPerPeriod`
- `rolloverPolicy`: whether unused entitlement carries forward
- `curtailmentPriority`: compensation rank if constrained

Why: defines obligations when production or consumption deviates from forecast.

### 6) Settlement and Payment Terms

Mandatory:
- `paymentToken`: stablecoin address (or fiat ledger reference)
- `paymentDueDays`
- `lateFeeBps` or fixed late fee rule
- `settlementRecipient`: treasury/agent receiving payment

Optional:
- `securityDepositAmount`
- `creditLimit`
- `autoDebitEnabled`
- `thirdPartyPayer` (landlord, aggregator, sponsor)

Why: in your architecture, negative balances are settled externally and must map to contractually agreed payment terms.

### 7) Environmental Attributes and Certificates

Mandatory decision:
- `recOwnership`: buyer, seller, shared, or excluded

Optional:
- `certificateRegistryRef`
- `greenPremiumMicrosPerKwh`

Why: REC/GO ownership is often a major legal/commercial term and should be explicit.

### 8) Risk, Performance, and Legal Clauses

Mandatory:
- `forceMajeureRuleRef`
- `defaultEventsRef`
- `disputeResolutionRef`
- `jurisdictionRef`

Optional:
- `performanceGuaranteeKwh`
- `availabilityGuaranteePct`
- `liquidatedDamagesRuleRef`

Why: these are usually off-chain legal clauses but should be cryptographically linked from chain.

---

## Typical Nano PPA Parameter Set (Practical Baseline)

For a residential/community microgrid Nano PPA, these are commonly present:

- Contract term: 1 to 5 years (sometimes longer)
- Price form: fixed or TOU-linked
- Price adjustment: annual escalator (for example 0% to 3.5%)
- Billing period: monthly
- Metering basis: interval meter at point of delivery
- Settlement basis: actual metered kWh (net of agreed adjustments)
- Curtailment rule: whether curtailed energy is compensated and at what rate
- Payment terms: net 10/15/30 days
- Default/termination: notice + cure period + termination formula
- Environmental attributes: explicit REC/GO ownership

For community/microgrid contexts, also common:
- Capacity reservation or demand component (kW term)
- Islanding/emergency mode service rules
- Import/export valuation hierarchy
- Priority order among households during scarcity

---

## On-Chain vs Off-Chain Split (Recommended)

Keep on-chain only what is needed for deterministic settlement and governance. Keep legal prose and high-cardinality metadata off-chain.

### Store On-Chain (minimal but sufficient)

- Household wallet and active flag
- Device IDs mapped to wallet
- Term boundaries (`startTs`, `endTs`)
- Tariff type and numeric price parameters
- Volume commitment parameters
- Payment token and settlement mode
- Hashes for legal documents and TOU schedules
- Version and amendment nonce

### Store Off-Chain (referenced by hash/URI)

- Full legal contract text
- KYC/identity records
- Utility tariff source docs
- Detailed metering and telemetry history
- Dispute evidence and legal correspondence

---

## Suggested On-Chain Structs (Nano PPA Layer)

Your current `addMember(address, deviceIds, ownershipPercentage)` covers only part of a Nano PPA. A dedicated agreement registry can extend this cleanly.

```solidity
enum TariffType { FIXED, TOU, INDEXED, HYBRID }
enum SettlementMode { PAY_AS_CONSUMED, TAKE_OR_PAY, MIN_OFFTAKE }
enum PpaStatus { DRAFT, ACTIVE, SUSPENDED, TERMINATED, EXPIRED }

struct NanoPpaCore {
    bytes32 ppaId;
    address householdWallet;
    uint256[] deviceIds;
    uint64 startTs;
    uint64 endTs;
    TariffType tariffType;
    SettlementMode settlementMode;
    uint256 basePriceMicrosPerKwh;
    uint256 minOfftakeKwhPerPeriod;
    uint256 maxTakeKwhPerPeriod;
    address paymentToken;
    uint32 paymentDueDays;
    PpaStatus status;
    bytes32 legalTermsHash;   // off-chain contract text hash
    bytes32 tariffScheduleHash; // TOU/index details hash
    uint32 version;
}
```

---

## Mapping to Your Current EMS Contract

Already represented in `EnergyDistributionImplementation`:
- Household wallet (`memberAddress`)
- Device mapping (`deviceIds` and `deviceToMember`)
- Ownership share (`ownershipPercentage`, basis points)
- Settlement pathway (`settlementContract` + debt settlement)

Not yet represented (should be added in Nano PPA layer):
- Time-bounded agreement term (`start/end`)
- Tariff variants beyond pool ordering
- Minimum/maximum offtake commitments
- Payment deadline and late fee policy
- REC/GO ownership
- Legal clause references and dispute metadata

---

## Parameter Checklist for Household Onboarding

Before activating a Nano PPA on-chain, collect and validate:

1. Wallet and legal signer linkage
2. Device IDs and meter verification
3. Start/end dates and billing cycle
4. Price model and units
5. Volume commitment model
6. Settlement token and payment deadlines
7. REC/GO ownership choice
8. Signed legal terms hash
9. Oracle/backend source and attestation policy
10. Governance approval reference (proposal ID)

---

## Unit Conventions (Strongly Recommended)

To avoid settlement ambiguity:
- Energy: `Wh` or `kWh * 1e3` integer base (pick one globally)
- Price: micros per kWh (for fiat-like precision)
- Percentages: basis points (`10000 = 100%`)
- Time: Unix seconds UTC
- Currency/token decimals: explicit in config

---

## External References Used

- [DOE FEMP: Power Purchase Agreements](https://www.energy.gov/femp/articles/power-purchase-agreements)
- [NREL: Standard Contracts and Securitization Resources](https://www.nrel.gov/analysis/standard-contracts.html)
- [Hawaiian Electric: Microgrid Services Tariff](https://www.hawaiianelectric.com/about-us/our-vision-and-commitment/resilience/microgrid-services-tariff)

Note: Nano PPA enforceability depends on local regulation and utility tariff rules. Treat this as a technical/commercial schema guide, then align legal terms with jurisdiction counsel.
