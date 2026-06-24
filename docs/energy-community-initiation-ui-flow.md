# Energy Community Initiation — UI Flow (Backend Handoff)

This document answers the question: **what happens in the Hypha UI when a DAO Space initiates a new energy community?** It is written for the backend developer who sends **15-minute interval meter data** and needs to understand integration points, identifiers, and objects created by the flow.

For the interval row shape and validation rules, see [`packages/storage-evm/ENERGY_INTERVAL_DATA_FEED.md`](../packages/storage-evm/ENERGY_INTERVAL_DATA_FEED.md). For contract-level settlement detail, see [`packages/storage-evm/README-energy-demo-comprehensive.md`](../packages/storage-evm/README-energy-demo-comprehensive.md).

---

## End-to-end picture

```text
DAO Space (Hypha UI)
  │
  ├─ Member opens Create Action → "Enable Energy Community"
  ├─ Fills governance proposal + energy activation form
  ├─ Submits proposal (discussion → vote)
  │
  └─ On vote pass:
        Space Executor calls EnergyPPAv2Factory.deployCommunity()
              │
              ├─ EnergyPPAv2 proxy (accounting contract)
              ├─ EnergyToken (credit token)
              ├─ RegularSpaceToken per source (ownership shares)
              └─ Members + device ID mappings registered on-chain
                    │
                    ▼
        Hypha syncs activation → Postgres `energy_communities`
                    │
                    ▼
        Your backend ingests 15-min rows → VPP → consumeEnergy()
```

Your integration starts **after** `deployCommunity` succeeds. The UI flow defines the **member addresses**, **device IDs**, **source IDs**, and **community identifiers** your feed must align with.

---

## Preconditions

| Check | Where enforced |
|-------|----------------|
| Space exists with `web3SpaceId` (on-chain DAO space) | Hypha DB + `DAOSpaceFactory` |
| Space is **not** already energy-enabled | `energy_communities` lookup; create route redirects if mapping exists |
| Member can create proposals | Standard Hypha governance permissions |
| Chain | Base mainnet (`chainId = 8453`) for all energy contracts |

---

## UI flow pseudocode

### 1. Entry — Create Action menu

```text
FUNCTION showCreateActions(space):
  energy = GET /api/v1/spaces/{spaceSlug}/energy

  IF energy.enabled == false:
    SHOW action "Enable Energy Community"
         href: /{lang}/dho/{spaceSlug}/agreements/create/enable-energy-community
  ELSE:
    SHOW energy follow-up actions:
      - Energy Sharing Proposal
      - Register Energy Source
      - Add Energy Member
      - Change Energy Optimization
    // These mutate an existing community; not covered here.
```

**Route:** `apps/web/src/app/[lang]/dho/[id]/@aside/agreements/create/enable-energy-community/page.tsx`

**Server guard:**

```text
FUNCTION loadEnableEnergyCommunityPage(spaceSlug):
  space = findSpaceBySlug(spaceSlug)
  IF NOT space: NOT_FOUND

  IF findEnergyCommunityBySpaceId(space.id):
    REDIRECT back to agreements (already activated)

  members, spaces = fetchMembersAndSpaces(space.id)
  RENDER CreateEnableEnergyCommunityForm(...)
```

---

### 2. Form load — resolve space executor

The form reads the **space executor** from `DAOSpaceFactory.getSpaceExecutor(web3SpaceId)`. This address becomes the on-chain **admin** for the deployed community.

```text
FUNCTION onFormMount(web3SpaceId):
  executor = readContract(
    DAOSpaceFactory,
    getSpaceExecutor(web3SpaceId)
  )
  SET form.energyCommunityActivation.admin = executor   // display only; forced at submit
  SET form.energyCommunityActivation.stablecoin = BASE_USDC  // default
```

**Why this matters for backend:** Hypha discovers deployments via `EnergyPPAv2Factory.getAdminCommunities(admin)`. The `admin` is the **space executor smart account**, not necessarily the space wallet address. Your ops scripts should use the executor address when looking up `factoryCommunityId`.

---

### 3. User fills the proposal form

Two layers: standard governance fields + energy-specific plugin.

#### 3a. Standard proposal fields

| Field | Purpose |
|-------|---------|
| Title | Human-readable proposal name |
| Description | Markdown body shown to voters |
| Lead image / attachments | Optional |

#### 3b. Energy community activation (`energyCommunityActivation`)

| Field | Maps to on-chain | Backend relevance |
|-------|------------------|-------------------|
| Admin | `CommunityParams.admin` | **Forced to executor** at submit |
| Stablecoin | `stablecoin` | Settlement token (default Base USDC) |
| Grid operator | `gridOperator` | Can claim grid export credits |
| Community address | `communityAddress` | Receives community fee slice |
| Aggregator address | `aggregatorAddress` | Receives aggregator fee slice |
| Community fee % | `communityFeeBps` | e.g. 5% → 500 bps |
| Aggregator fee % | `aggregatorFeeBps` | e.g. 3% → 300 bps |
| Export device ID | `exportDeviceId` | Special meter for grid export (e.g. `9999`) |
| Energy token name / symbol | `energyTokenName`, `energyTokenSymbol` | Credit token metadata |
| **Members** | `MemberConfig[]` | **Your meter_id → address mapping** |
| **Sources** | `SourceConfig[]` | Production sources + ownership |

#### 3c. Members — device ID assignment

The UI asks for **member address + meter count** (not raw device IDs). The form assigns sequential device IDs:

```text
FUNCTION formMembersToOnChain(members[]):
  nextDeviceId = 1
  FOR EACH member IN members:
    deviceIds = []
    FOR i = 1 .. member.meterCount:
      deviceIds.push(nextDeviceId)
      nextDeviceId += 1
    OUTPUT { memberAddress, deviceIds, metadataHash: 0x00..00 }
```

**Example:** 5 households with 1 meter each → device IDs `1, 2, 3, 4, 5`.

**Backend action:** After activation, read member→device mapping from chain (`EnergyPPAv2.members` / `deviceToMember`) or from the proposal payload. Your 15-min feed must use these **exact meter IDs** for consumption rows.

#### 3d. Sources — ownership and pricing

Each source row:

| UI field | On-chain field | Notes |
|----------|----------------|-------|
| Name | `sourceId = keccak256(name)` | Human label hashed to bytes32 |
| Type (SOLAR / BATTERY) | `sourceType` | Enum |
| Base price per kWh | `basePricePerKwh` | UI decimal → internal units (×100) |
| Owners (address + %) | `holders`, `holderAmounts` | Percentages → basis points (must total 100%) |
| Token name / symbol | ownership token metadata | `RegularSpaceToken` per source |

**Validation rule:** Every source owner must also appear in the members list (meter count `0` is fine). Otherwise they would not receive revenue distributions.

#### 3e. Optimization strategy (optional)

| Field | On-chain |
|-------|----------|
| Purpose ranking (3 objectives) | `purposeRanking` |
| Social mode (NONE / FIXED / VARIABLE) | `socialMode` |
| Social fixed kWh / variable % | `socialFixedKwh`, `socialVariableBps` |
| Goal wallets + shares | `socialWallets`, `socialWalletShares` |

This configures the off-chain VPP priority rules. It does not change your interval row shape, but it affects how production is allocated before `consumeEnergy`.

---

### 4. Submit — create governance proposal

```text
FUNCTION onSubmit(formValues):
  payload = mapPayload(formValues)           // human-readable summary for voters
  description = appendEnergyProposalMarker(
    formValues.description,
    "Enable Energy Community",
    payload
  )

  deployInput = formToDeployInput(formValues, executorAddress)
  deployInput.admin = executorAddress      // always executor, not user-typed admin

  extraTransactions = [
    buildDeployCommunityTransaction(deployInput)
    // target: EnergyPPAv2Factory
    // method: deployCommunity(CommunityParams)
  ]

  createAgreement({
    title, description, label: "Enable Energy Community",
    spaceId, web3SpaceId,
    extraTransactions
  })
```

**Proposal marker:** A JSON block is appended to the description between `__hypha_energy_proposal__` markers. This lets the UI render structured energy data on the proposal card without a separate DB column.

**On-chain execution:** When the proposal passes, the space **executor** runs `EnergyPPAv2Factory.deployCommunity(p)`. The factory atomically:

1. Deploys `EnergyToken`
2. Deploys UUPS `EnergyPPAv2` proxy
3. Deploys one `RegularSpaceToken` proxy per source; mints ownership shares
4. Registers sources, members, fees, export device, optimization config
5. Whitelists admin; transfers PPA ownership to admin (executor)

**Returns:** `(communityId, proxyAddress)`

---

### 5. Post-activation — Hypha sync

After deployment, Hypha links the DAO space to the on-chain community:

```text
FUNCTION syncEnergyCommunity(space):
  adminCandidates = [space.address, getSpaceExecutor(web3SpaceId)]

  FOR admin IN adminCandidates:
    communityIds = factory.getAdminCommunities(admin)
    IF communityIds is empty: CONTINUE

    latestId = communityIds[last]
    record = factory.communities(latestId)
    // record = { proxy, energyToken, admin, deployedAt }

    UPSERT energy_communities:
      space_id          = space.id
      chain_id          = 8453
      community_proxy_address = record.proxy
      energy_token_address    = record.energyToken
      admin_address           = admin
      factory_community_id    = latestId
      activated_at            = now()

    RETURN activation
```

**Trigger:** `GET /api/v1/spaces/{spaceSlug}/energy` runs sync when no DB row exists but on-chain deployment is found.

**UI effect:** Create Action menu switches from "Enable Energy Community" to energy follow-up actions. Energy tab and treasury widgets appear (`spaceEnergy.enabled === true`).

---

## Objects your backend needs after activation

### From Postgres (`energy_communities`)

| Column | Use in your feed |
|--------|------------------|
| `factory_community_id` | **`community_id` in interval rows** |
| `community_proxy_address` | Target for `consumeEnergy` calls |
| `admin_address` | Whitelisted submitter for readings |
| `space_id` | Hypha internal link only |

### From on-chain (`EnergyPPAv2` proxy)

| State | Use |
|-------|-----|
| `deviceToMember[deviceId]` | Validate consumption meter IDs |
| `sources[sourceId]` | Map production to source for settlement |
| `exportDeviceId` | Do not use for household consumption |
| `members[]` | Member addresses and registered devices |

### From your interval table (Azure Postgres / legacy RDS)

Expected row shape (see `ENERGY_INTERVAL_DATA_FEED.md`):

```ts
type IntervalReading = {
  interval_start: string;   // ISO-8601, quarter-hour aligned, UTC
  meter_id: number;         // Must match on-chain device IDs
  community_id: number;     // Must match factory_community_id
  energy_wh: number;        // Integer watt-hours for the 15-min bucket
  direction: 'consumption' | 'production' | 'import';
};
```

---

## Backend processing loop (pseudocode)

This is the path your 15-min data takes after the UI flow completes:

```text
EVERY 15 MINUTES (or on poll):
  readings = SELECT * FROM accounting.interval_readings
             WHERE community_id = :factoryCommunityId
               AND interval_start = :currentQuarterHour
               AND processed = false

  IF readings is empty: RETURN

  allocations = VPP.runInterval(readings, optimizationConfig, sourceOwnership)

  // allocations → ConsumptionReading[] for EnergyPPAv2.consumeEnergy
  tx = ppaProxy.consumeEnergy(readings, timestamp)

  MARK readings processed
  STORE checkpoint (last interval_start)
```

Reference implementation: `packages/storage-evm/scripts/base-mainnet-contracts-scripts/energy-ppav2-rds-loop.ts`

---

## Integration checklist for new communities

When a DAO Space completes "Enable Energy Community" through the UI:

1. **Wait for proposal to pass** — nothing is deployed until vote succeeds.
2. **Confirm activation** — `GET /api/v1/spaces/{slug}/energy` returns `enabled: true` with `activation.factoryCommunityId`.
3. **Record identifiers:**
   - `community_id` = `factoryCommunityId`
   - `ppa_proxy` = `communityProxyAddress`
   - Member meter IDs from on-chain `members` or proposal payload
   - Source IDs (bytes32) from on-chain `sources`
   - `export_device_id` from `roles.exportDeviceId`
4. **Configure production meter mapping** if your ingestion uses numeric production meter IDs (e.g. `9001` → solar source bytes32).
5. **Start sending 15-min rows** with the correct `community_id` and `meter_id` values.
6. **Ensure submitter wallet is whitelisted** on the PPA proxy for `consumeEnergy` (admin/ops account, not the UI user).

---

## What the UI does *not* do (backend owns these)

| Concern | Owner |
|---------|-------|
| Ingesting smart-meter telemetry | Backend |
| Storing interval readings in Postgres | Backend |
| VPP fair-split / optimization algorithm | Backend (`packages/storage-evm/vpp/`) |
| Calling `consumeEnergy` on-chain | Backend loop |
| Production meter ID → source ID mapping | Backend config |
| Grid import/export computation | Backend VPP (export uses `exportDeviceId`) |

---

## Follow-up UI flows (after activation)

These are separate proposals, not part of initial activation, but they change objects your feed must respect:

| Proposal | On-chain effect | Backend impact |
|----------|-----------------|----------------|
| Add Energy Member | `addMember(address, deviceIds, metadataHash)` | New meter IDs to accept |
| Register Energy Source | New source + ownership token | New production source ID in VPP |
| Change Energy Optimization | `setOptimizationConfig`, `setSocialWallets` | VPP allocation rules change |
| Energy Sharing | Governance-only parameters | May affect settlement policy |

---

## Key source files (Hypha side)

| Area | Path |
|------|------|
| Create action menu gating | `apps/web/src/app/[lang]/dho/[id]/_components/select-create-action.tsx` |
| Enable route + guard | `apps/web/src/app/[lang]/dho/[id]/@aside/agreements/create/enable-energy-community/page.tsx` |
| Form + deploy tx builder | `packages/epics/src/governance/components/create-enable-energy-community-form.tsx` |
| Energy form fields UI | `packages/epics/src/agreements/plugins/enable-energy-community/` |
| Proposal submit orchestration | `packages/epics/src/governance/components/create-energy-proposal-form.tsx` |
| Factory calldata builder | `packages/core/src/energy/client/contracts.ts` |
| Activation sync + API | `apps/web/src/app/api/v1/spaces/[spaceSlug]/energy/route.ts` |
| DB mapping | `packages/storage-postgres/src/schema/energy-community.ts` |
| Factory contract | `packages/storage-evm/contracts/EnergyPPAv2Factory.sol` |
| Accounting contract | `packages/storage-evm/contracts/EnergyPPAv2.sol` |

---

## Demo reference values

The live demo community (for testing your integration against known IDs) is documented in:

- [`ENERGY_INTERVAL_DATA_FEED.md`](../packages/storage-evm/ENERGY_INTERVAL_DATA_FEED.md) — meter IDs, row shape, validation
- [`README-energy-demo-enable-energy-community-ui.md`](../packages/storage-evm/README-energy-demo-enable-energy-community-ui.md) — exact UI field values used in the demo

---

## Open integration topics to align on

1. **Production meter IDs** — The UI does not assign production meter IDs; only consumption devices are registered via member meter counts. Agree on `productionDeviceToSource` mapping per community.
2. **`community_id` namespace** — Interval rows use `factoryCommunityId` from the factory (`0`, `1`, …). Confirm this matches your DB schema.
3. **New community notification** — Today, backend discovers new communities via polling the API or factory events. We can add a webhook or event subscription if needed.
4. **Missing intervals** — Policy for gaps (zero-fill vs skip vs alert).
5. **Whitelisting** — Which ops wallet submits `consumeEnergy` for each community.
