# Energy Community 15-Minute Data Feed

This document is a handoff for the developer sending 15-minute interval meter
data into the EnergyPPAv2 VPP/settlement flow.

It describes the current Base mainnet demo community configured by
`README-energy-demo.md`, `energy-ppav2-mainnet-demo.ts`,
`energy-ppav2-vpp-loop.ts`, and `energy-ppav2-demo-state.json`.

## Community

| Field | Value |
|---|---|
| Network | Base mainnet |
| Chain ID | `8453` |
| Community ID | `0` |
| PPA contract | `0xd0BCe7dfE24c1df30cA7aBe77A7feeF2679ebe1b` |
| Factory | `0xB8e042Bc361d1D44Cfe408667B63fAe7E10B90ef` |
| Energy token | `0x483480996d6E373D2E6621ce89B984e78988268B` |

## Meter IDs to Send

Send one consumption row per household meter for every 15-minute interval.
These are the meter IDs currently registered on-chain as member device IDs.

| Household | Meter ID | Member address |
|---|---:|---|
| HH 1 | `1` | `0x449Fa519B376Ed35CE3Ee91ea549C5b07D5930e9` |
| HH 2 | `2` | `0xc514f43c5d426C484fAa6aB710F44f7543CD1603` |
| HH 3 | `3` | `0x20C6cC32ba68Ae7289B7D974dbE942EEAE21575B` |
| HH 4 | `4` | `0x669Bf1D04C4638ade9273EfcA653AACB552F558F` |
| HH 5 | `5` | `0xEf3DB1384D914B8F9182CDC45aF6d7665Ae5CB07` |

Do not send rows for the investor addresses. They have no meters and only
receive source ownership revenue.

## Export Meter

The contract export device ID is:

| Purpose | Meter/device ID |
|---|---:|
| Grid export settlement device | `9999` |

Do not send normal household consumption rows using meter ID `9999`. In the
current VPP flow, export readings are computed by the backend from surplus
production and written to the contract using this device ID.

## Production Sources

The demo has three energy sources. The current demo scripts generate production
directly by source, not by numeric production meter ID. No production meter IDs
are registered on-chain.

If your ingestion layer requires numeric production meter IDs, configure the
backend `productionDeviceToSource` map before sending production rows. The IDs
below are proposed integration IDs for this feed; replace them with the real
source meter IDs if the metering system already has them.

| Source | Recommended production meter ID | Source ID | Price |
|---|---:|---|---:|
| Solar park | `9001` | `0x06c8993185e0aa106cc6c3ed3ad7ee2f631d21689edc12b5835e9e0cab8cef9b` | `10` ct/kWh |
| Battery 1 | `9002` | `0x0da3b72be79353eef15b379e1c635befa93722bb4d116f89053462ee538d56a6` | `15` ct/kWh |
| Battery 2 | `9003` | `0x7b2e151b60588c1b6572871f701ff4a9d9626fbe26df6d4363ba9517941a68f4` | `12` ct/kWh |

If the production meter IDs already exist in the real metering system, use those
instead and update the backend mapping to point them at the source IDs above.

## Expected Interval Row Shape

The VPP type for incoming interval rows is:

```ts
type IntervalReading = {
  interval_start: string;
  meter_id: number;
  community_id: number;
  energy_wh: number;
  direction: 'consumption' | 'production' | 'import';
};
```

Use integer watt-hours (`energy_wh`) for the 15-minute interval. The current demo
VPP converts Wh to kWh before submitting to the contract.

Use an ISO-8601 timestamp for `interval_start`. Prefer UTC timestamps aligned to
quarter-hour boundaries, for example `2026-05-05T09:00:00Z`,
`2026-05-05T09:15:00Z`, `2026-05-05T09:30:00Z`.

## Example Payload

This example contains five household consumption readings and three production
readings for one 15-minute interval.

```json
[
  {
    "interval_start": "2026-05-05T09:00:00Z",
    "meter_id": 1,
    "community_id": 0,
    "energy_wh": 3200,
    "direction": "consumption"
  },
  {
    "interval_start": "2026-05-05T09:00:00Z",
    "meter_id": 2,
    "community_id": 0,
    "energy_wh": 2800,
    "direction": "consumption"
  },
  {
    "interval_start": "2026-05-05T09:00:00Z",
    "meter_id": 3,
    "community_id": 0,
    "energy_wh": 4100,
    "direction": "consumption"
  },
  {
    "interval_start": "2026-05-05T09:00:00Z",
    "meter_id": 4,
    "community_id": 0,
    "energy_wh": 2500,
    "direction": "consumption"
  },
  {
    "interval_start": "2026-05-05T09:00:00Z",
    "meter_id": 5,
    "community_id": 0,
    "energy_wh": 3600,
    "direction": "consumption"
  },
  {
    "interval_start": "2026-05-05T09:00:00Z",
    "meter_id": 9001,
    "community_id": 0,
    "energy_wh": 18000,
    "direction": "production"
  },
  {
    "interval_start": "2026-05-05T09:00:00Z",
    "meter_id": 9002,
    "community_id": 0,
    "energy_wh": 5000,
    "direction": "production"
  },
  {
    "interval_start": "2026-05-05T09:00:00Z",
    "meter_id": 9003,
    "community_id": 0,
    "energy_wh": 3000,
    "direction": "production"
  }
]
```

## Validation Rules

- Send exactly one interval bucket per `interval_start`; aggregate raw readings
  before sending if the source system has finer-grained data.
- Consumption rows must use meter IDs `1`, `2`, `3`, `4`, or `5`.
- Production rows must map to one of the configured source IDs.
- `energy_wh` must be a non-negative integer.
- Missing consumption for a household is treated as zero only if the backend
  explicitly allows missing meters. Prefer sending `energy_wh: 0` when a meter
  has no usage for the interval.
- Do not send grid import as a required input. The VPP computes grid import as
  the remaining deficit after local production is allocated. Import rows are
  informational only in the current `run-interval.ts` parser.

## Ownership and Settlement Context

The VPP uses the interval data together with source ownership:

| Source | Ownership |
|---|---|
| Solar park | HH 1-5 each own 10%; Investor 1 and Investor 2 each own 25% |
| Battery 1 | Investor 1 owns 50%; Investor 2 owns 50% |
| Battery 2 | Investor 2 owns 100% |

Prices are configured as:

| Item | Price |
|---|---:|
| Solar | `10` ct/kWh |
| Battery 1 | `15` ct/kWh |
| Battery 2 | `12` ct/kWh |
| Grid import | `30` ct/kWh |
| Grid export | `8` ct/kWh |

Community fee is `5%`; aggregator fee is `3%`.

## Important Note About Older Scripts

`deploy-energy-ppa-v2-factory.ts` contains an older standalone deployment
scenario with household device IDs `101`-`105` and export device `100`. The
Hardhat functional and gas tests also use isolated fixture IDs such as `1001`,
`2001`, `3001`, and `4001`. Do not use those IDs for the current demo community
described above.
