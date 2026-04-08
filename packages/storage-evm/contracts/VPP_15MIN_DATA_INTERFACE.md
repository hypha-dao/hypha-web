# VPP 15-Minute Aggregated Data Interface

This document describes the data interface between the aggregation layer (TimescaleDB) and the VPP (Virtual Power Plant) backend. Every 15 minutes, the aggregation job produces one record per meter, which the VPP reads to run the fair-split settlement algorithm.

---

## Database schema

```sql
CREATE TABLE interval_readings (
    interval_start  TIMESTAMPTZ  NOT NULL,
    meter_id        INTEGER      NOT NULL,
    community_id    INTEGER      NOT NULL,
    energy_wh       INTEGER      NOT NULL,
    direction       TEXT         NOT NULL,  -- 'consumption' | 'production' | 'import'
    PRIMARY KEY (interval_start, meter_id)
);
```

`meter_id` and `community_id` are integers to match the downstream blockchain contract where devices are identified by `uint256 deviceId`.

---

## JSON payload (query result passed to VPP)

One array per 15-minute interval. Each element represents a single meter's aggregated reading:

```json
[
  { "interval_start": "2025-01-15T14:00:00Z", "meter_id": 1001, "community_id": 1, "energy_wh": 2000, "direction": "consumption" },
  { "interval_start": "2025-01-15T14:00:00Z", "meter_id": 2001, "community_id": 1, "energy_wh": 5000, "direction": "consumption" },
  { "interval_start": "2025-01-15T14:00:00Z", "meter_id": 3001, "community_id": 1, "energy_wh": 1000, "direction": "consumption" },
  { "interval_start": "2025-01-15T14:00:00Z", "meter_id": 4001, "community_id": 1, "energy_wh": 3000, "direction": "consumption" },
  { "interval_start": "2025-01-15T14:00:00Z", "meter_id": 5001, "community_id": 1, "energy_wh": 8000, "direction": "production"  },
  { "interval_start": "2025-01-15T14:00:00Z", "meter_id": 5002, "community_id": 1, "energy_wh": 2000, "direction": "production"  },
  { "interval_start": "2025-01-15T14:00:00Z", "meter_id": 5003, "community_id": 1, "energy_wh": 1000, "direction": "import"       }
]
```

Meter 1001 = Alice, 2001 = Bob, 3001 = Carol, 4001 = Dave, 5001 = Solar Park, 5002 = Battery, 5003 = Grid. These IDs match the `deviceId` used in the on-chain settlement contract.

---

## Field reference

| Field            | Type                 | Description                                                                 |
|------------------|----------------------|-----------------------------------------------------------------------------|
| `interval_start` | `string` (ISO 8601)  | Start of the 15-min window, always on :00 / :15 / :30 / :45 boundaries. UTC. |
| `meter_id`       | `integer`            | Unique identifier for the physical meter. Maps directly to `deviceId` on-chain. |
| `community_id`   | `integer`            | Identifies which energy community this reading belongs to.                  |
| `energy_wh`      | `integer`            | Total energy in **watt-hours**. Always positive. Integer to avoid FP drift. |
| `direction`      | `string` enum        | One of `"consumption"`, `"production"`, or `"import"`.                      |

### `direction` values

| Value           | Meaning                                                        |
|-----------------|----------------------------------------------------------------|
| `"consumption"` | Household or consumer meter — energy drawn from the shared wire. |
| `"production"`  | Generation asset (solar park, battery discharge).              |
| `"import"`      | Grid connection meter — energy imported from the external grid. |

---

## Aggregation formula

Each raw reading covers a 10-second sampling window. The aggregation job converts instantaneous power (watts) into energy (watt-hours):

```
energy_wh = ROUND( SUM(power_w * 10) / 3600 )
```

For example, 90 readings averaging 1200 W over 15 minutes:

```
energy_wh = ROUND( (90 × 1200 × 10) / 3600 ) = 3000 Wh = 3.0 kWh
```
