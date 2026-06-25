# energy3000 — Backend Configuration

Handoff for the developer sending **15-minute interval data** to the community at:

`https://pr-2190.preview-app.hypha.earth/en/dho/energy3000/energy`

> **Note:** The UI shows **2 sources** — "Solar 1" and "Battery 2". That is one solar + one battery. "Battery 2" is just the UI label for the second source card, not a second battery asset. This community is **not** the old 3-source engineering demo.

---

## Core IDs

| Field | Value |
|-------|-------|
| Space slug | `energy3000` |
| Chain ID | `8453` (Base mainnet) |
| **`community_id`** (use in interval rows) | **`1`** |
| PPA proxy (`consumeEnergy` target) | `0x8477F40d7767D0664cd93A8eE0A05c9f3A21efB6` |
| Factory | `0x5F07320B3C95C6fB0A0D77d707F14aC95A897E90` |
| Energy token | `0x5311Cb21B23229942096d22FCfFd39B9B5249501` |
| Admin (space executor) | `0xfFc7c73Ecc66C69fe75a8F46aC6AB1c1100fd4cD` |

---

## Energy sources (2)

| UI label | Type | Base price | Source ID (bytes32) | Ownership token |
|----------|------|----------:|---------------------|-----------------|
| Solar 1 | SOLAR | 11 | `0x13566d9fa53eb7f2eb76a7d7a21b80a36bdba8a90a7c90b493891469fda8652c` | `0x319fAB3dFFA2EfAE0B2ba81f43eC6C7763D0B8ff` |
| Battery 2 | BATTERY | 10 | `0xeaf79c4488418f2e84a0513901999598bbf9b8c22eb62911c4f4ff7d581606df` | `0x58C497D6BdCBbaFbc7e4377B25bd867B70787e0e` |

Prices are on-chain internal units (11 = 0.11/kWh, 10 = 0.10/kWh).

---

## Consumption meters

| Meter ID | Member address |
|---------:|----------------|
| `1` | `0xE27F33cA8037A2B0F4D3d4F9B8CcD896c2674484` |
| `2` | `0x3e7Fee7B8238Fe6aC8C18a8AaB03Ff4849bb3D34` |
| `3` | `0x7067F2BC9a3f2D5064C09D725B544250226ce17C` |
| `4` | `0x7067F2BC9a3f2D5064C09D725B544250226ce17C` |

Member `0x4f7fB0A9744Cb7c3cdb1B3fC63C0e0e531d5c213` has no meters (revenue-only). Confirm any additional members via `GET /api/v1/spaces/energy3000/energy`.

---

## Production meters

Configure `productionDeviceToSource` on your side:

| Meter ID | Maps to |
|---------:|---------|
| `9001` | Solar source (`0x13566d9f…8652c`) |
| `9002` | Battery source (`0xeaf79c44…606df`) |

There is **no** third production meter for this community.

---

## Interval row shape

Write to `accounting.interval_readings`:

```json
{
  "interval_start": "2026-06-25T09:00:00Z",
  "meter_id": 1,
  "community_id": 1,
  "energy_wh": 3200,
  "direction": "consumption"
}
```

- `community_id` = **`1`**
- `interval_start` = UTC, quarter-hour aligned
- `energy_wh` = integer watt-hours for the 15-min bucket
- One row per `(interval_start, meter_id, direction)`

---

## Related docs

- `packages/storage-evm/ENERGY_INTERVAL_DATA_FEED.md` — interval row spec (uses the older demo as an example; IDs differ here)
- `docs/energy-community-initiation-ui-flow.md` — how the UI creates a community
