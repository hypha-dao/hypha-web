# Enable Energy Community — UI field guide and copy-paste values

This document mirrors the **current Base mainnet EnergyPPAv2 demo** configured in `scripts/base-mainnet-contracts-scripts/energy-ppav2-mainnet-demo.ts` and recorded in `scripts/base-mainnet-contracts-scripts/energy-ppav2-demo-state.json`. Use it to pre-fill the Hypha **Create Enable Energy Community Proposal** form.

**On-chain reference deployment (Base chain id 8453):**

- PPA proxy: `0xd0BCe7dfE24c1df30cA7aBe77A7feeF2679ebe1b`
- Factory: `0xB8e042Bc361d1D44Cfe408667B63fAe7E10B90ef`
- `communityId` in app / RDS filter: `0`

Values below are the **same parameters** the demo script uses, with role addresses taken from the live contract where applicable (admin from EnergyToken `owner()`, community / aggregator / grid operator from the PPA getters). Stablecoin matches the script default (Base USDC). Household and investor addresses come from `energy-ppav2-demo-state.json`.

---

## Standard agreement fields (not energy-specific)

| Field | What it is | Suggested value |
|--------|------------|-----------------|
| **Proposal title** | Short label for voters. | `Enable Energy Community — PPA Demo v5` |
| **Proposal Content** | Markdown body; describe governance intent. | One paragraph that this proposal deploys an EnergyPPAv2 community aligned with the engineering demo (5 households, 2 investors, solar + two batteries, 5% / 3% fees, export device 9999). |
| **Preview image / attachments** | Optional media. | None required for testing. |

---

## Energy community activation block

### Admin Address

**Meaning:** Address that owns the EnergyToken and administers the PPA (whitelist, members, emergencies). Must be a wallet your collective controls.

**Copy-paste:**

```text
0x2687fe290b54d824c136Ceff2d5bD362Bc62019a
```

*(This is the on-chain `owner()` of the demo EnergyToken for the reference deployment.)*

---

### Stablecoin Address

**Meaning:** ERC-20 used for debt settlement and credit claims (6 decimals on Base USDC in this demo). Internal energy credits map to stablecoin amounts per contract rules (`README-energy-demo.md`).

**Copy-paste:**

```text
0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
```

---

### Grid Operator Address

**Meaning:** Account allowed to claim grid export credits (`claimGridCredit`) when the community is a net exporter.

**Copy-paste:**

```text
0xFd50D6Fd9eEa0B9AcD57D6Ac26648f4985a59d1C
```

---

### Community Address (optional)

**Meaning:** Receives the **community fee** slice of consumption revenue. If zero on-chain, fee accruals skip that bucket.

**Copy-paste:**

```text
0x08354cf25aC97c6483A8cBbd7a206794E93E8499
```

---

### Aggregator Address (optional)

**Meaning:** Receives the **aggregator fee** slice after the community fee.

**Copy-paste:**

```text
0x12d49C28515f3b0Ac24655d288a386a8221e11f8
```

---

### Export Device ID (optional)

**Meaning:** Smart meter / logical device id used for **export** readings in `consumeEnergy`. The demo uses `9999` so export does not collide with household meters `1`–`5`.

**Copy-paste:**

```text
9999
```

---

### Community Fee BPS (optional)

**Meaning:** Community fee in [basis points](https://en.wikipedia.org/wiki/Basis_point) (100 BPS = 1%). Demo uses 5%.

**Copy-paste:**

```text
500
```

---

### Aggregator Fee BPS (optional)

**Meaning:** Aggregator fee after community fee. Demo uses 3%.

**Copy-paste:**

```text
300
```

---

### Energy Token Name

**Meaning:** Name of the ERC-20 **energy credit** token minted for the community.

**Copy-paste:**

```text
PPA Demo Energy v5
```

---

### Energy Token Symbol

**Meaning:** Symbol for that token.

**Copy-paste:**

```text
PPADEM
```

---

## Energy Sources (three rows)

The contract stores each **Source ID** as `bytes32`. The demo script sets them to `keccak256(utf8Bytes(...))` of short labels. You can paste either the **bytes32 hex** (matches chain state exactly) or the **UTF-8 label** if your execution path hashes the string the same way as `energy-ppav2-mainnet-demo.ts`.

**Labels used in the script:** `DEMO_SOLAR_V5`, `DEMO_BATTERY_1_V5`, `DEMO_BATTERY_2_V5`

**On-chain bytes32 (from `energy-ppav2-demo-state.json`):**

| Source | Source ID (bytes32, copy-paste) |
|--------|----------------------------------|
| Solar | `0x06c8993185e0aa106cc6c3ed3ad7ee2f631d21689edc12b5835e9e0cab8cef9b` |
| Battery 1 | `0x0da3b72be79353eef15b379e1c635befa93722bb4d116f89053462ee538d56a6` |
| Battery 2 | `0x7b2e151b60588c1b6572871f701ff4a9d9626fbe26df6d4363ba9517941a68f4` |

### Source 1 — Solar park

| Field | Copy-paste |
|--------|------------|
| **Source ID** | `0x06c8993185e0aa106cc6c3ed3ad7ee2f631d21689edc12b5835e9e0cab8cef9b` |
| **Source Type** | `SOLAR` |
| **Ownership Token Name** | `Demo Solar Park` |
| **Ownership Token Symbol** | `D-SOLAR` |
| **Base Price Per kWh** | `0.10` |
| **Holder Addresses** | `0x449Fa519B376Ed35CE3Ee91ea549C5b07D5930e9,0xc514f43c5d426C484fAa6aB710F44f7543CD1603,0x20C6cC32ba68Ae7289B7D974dbE942EEAE21575B,0x669Bf1D04C4638ade9273EfcA653AACB552F558F,0xEf3DB1384D914B8F9182CDC45aF6d7665Ae5CB07,0x613b299E64F4b45912105DB31Bc28368EcF1E988,0x2feDe7AcDE81562DD7CF2bE4304463cfEa53064e` |
| **Holder Amounts** | `1000,1000,1000,1000,1000,2500,2500` |

**Meaning:** Amounts are **shares out of 10,000** minted to each holder for this source (five households at 10% each, two investors at 25% each), matching `holderAmounts` in `energy-ppav2-mainnet-demo.ts`. **Base price** is the agreed PPA reference price per kWh in the settlement currency. Enter it as a decimal (e.g. `0.10`); the form converts it to the contract's internal units (1 unit = 0.01, so `0.10` → `10`). Both `.` and `,` are accepted as the decimal separator.

---

### Source 2 — Battery 1

| Field | Copy-paste |
|--------|------------|
| **Source ID** | `0x0da3b72be79353eef15b379e1c635befa93722bb4d116f89053462ee538d56a6` |
| **Source Type** | `BATTERY` |
| **Ownership Token Name** | `Demo Battery 1` |
| **Ownership Token Symbol** | `D-BAT1` |
| **Base Price Per kWh** | `0.15` |
| **Holder Addresses** | `0x613b299E64F4b45912105DB31Bc28368EcF1E988,0x2feDe7AcDE81562DD7CF2bE4304463cfEa53064e` |
| **Holder Amounts** | `5000,5000` |

---

### Source 3 — Battery 2

| Field | Copy-paste |
|--------|------------|
| **Source ID** | `0x7b2e151b60588c1b6572871f701ff4a9d9626fbe26df6d4363ba9517941a68f4` |
| **Source Type** | `BATTERY` |
| **Ownership Token Name** | `Demo Battery 2` |
| **Ownership Token Symbol** | `D-BAT2` |
| **Base Price Per kWh** | `0.12` |
| **Holder Addresses** | `0x2feDe7AcDE81562DD7CF2bE4304463cfEa53064e` |
| **Holder Amounts** | `10000` |

---

## Energy Members (optional)

**Meaning:** Registers members and maps **device IDs** to addresses for `consumeEnergy`. The demo script registers **seven** members: five households with meters `1`–`5`, two investors with **empty** device lists on-chain.

The Hypha form currently requires **at least one device ID per member row**. To mirror settlement behaviour while satisfying the form, use **unused** device IDs for investors (nothing in the demo emits consumption on these IDs):

| Member address | Metadata hash (bytes32) | Device IDs | Notes |
|----------------|-------------------------|------------|--------|
| `0x449Fa519B376Ed35CE3Ee91ea549C5b07D5930e9` | `0x0000000000000000000000000000000000000000000000000000000000000000` | `1` | HH1 |
| `0xc514f43c5d426C484fAa6aB710F44f7543CD1603` | `0x0000000000000000000000000000000000000000000000000000000000000000` | `2` | HH2 |
| `0x20C6cC32ba68Ae7289B7D974dbE942EEAE21575B` | `0x0000000000000000000000000000000000000000000000000000000000000000` | `3` | HH3 |
| `0x669Bf1D04C4638ade9273EfcA653AACB552F558F` | `0x0000000000000000000000000000000000000000000000000000000000000000` | `4` | HH4 |
| `0xEf3DB1384D914B8F9182CDC45aF6d7665Ae5CB07` | `0x0000000000000000000000000000000000000000000000000000000000000000` | `5` | HH5 |
| `0x613b299E64F4b45912105DB31Bc28368EcF1E988` | `0x0000000000000000000000000000000000000000000000000000000000000000` | `9001` | Inv1 — sentinel device (on-chain demo: no devices) |
| `0x2feDe7AcDE81562DD7CF2bE4304463cfEa53064e` | `0x0000000000000000000000000000000000000000000000000000000000000000` | `9002` | Inv2 — sentinel device (on-chain demo: no devices) |

If you prefer strict parity with empty investor device lists, register investors later via **Add Energy Member** once the form supports empty device lists.

---

## After deployment: AWS RDS ingestion loop

The script **`scripts/base-mainnet-contracts-scripts/energy-ppav2-rds-loop.ts`** connects to **PostgreSQL on AWS RDS** (using the `pg` client and TLS by default), reads `accounting.interval_readings`, runs the VPP fair-split from `vpp/`, and submits `consumeEnergy` to the PPA proxy. It is the “AWS-facing” piece of the demo: credentials and host come from environment variables, not from the UI.

**Run (from `packages/storage-evm`):**

```bash
ENERGY_DEMO_COMMAND=loop npx hardhat run scripts/base-mainnet-contracts-scripts/energy-ppav2-rds-loop.ts --network base-mainnet
```

**Required / common env vars:** see the table in `README-energy-demo.md` (`ENERGY_RDS_HOST`, `ENERGY_RDS_DATABASE`, `ENERGY_RDS_USER`, `ENERGY_RDS_PASSWORD`, `ENERGY_RDS_COMMUNITY_ID`, checkpoint and poll options). Ensure `energy-ppav2-demo-state.json` (or your state file) points at the same `ppaProxy` you activated.

---

## Related docs

- `README-energy-demo.md` — architecture, VPP, scripts, settlement, env vars
- `ENERGY_INTERVAL_DATA_FEED.md` — interval data shape for integrations
