# External Hypha Energy API — Blockers for Hypha Platform Integration

Send this to the Hypha Energy backend developer. Connectivity was verified on 2026-06-23.

## What works

- Azure Postgres (`hypha_v2`) connects over SSL
- `telemetry.raw_iot` — live power readings (~15k rows, updating)
- `accounting.interval_readings` — 15-min aggregated windows (~922 rows)
- REST API: `GET /health` and `GET /health/db` return OK

## Blockers

### 1. Oracle schema permission

`v2_vpp` has `SELECT` on `oracle.spot_market_prices`, `oracle.export_prices`, and `oracle.retailer_tariffs`, but **cannot use the schema**:

```text
permission denied for schema oracle
```

**Fix:**

```sql
GRANT USAGE ON SCHEMA oracle TO v2_vpp;
```

### 2. Price API routes return 404

These all return **404 with empty body** (even bare routes with no query params):

- `GET /v1/prices?market=AT&from=...&to=...`
- `GET /v1/prices/latest?market=AT`
- Same for `country_price_area`, `DE`, `AT-DE`, etc.

Hypha Platform VPP settlement falls back to hardcoded grid prices (30 / 8 ct/kWh) until this works.

**Fix:** Deploy or register the price routes on the production API instance.

**Also clarify:**

- Correct query param: `market` vs `country_price_area`?
- Valid area codes (e.g. is `AT` correct, or ENTSO-E `10YAT-APG------L`?)
- Docs mention `accounting.market_prices` — **that table does not exist**. Spot prices are in `oracle.spot_market_prices`.

### 3. `direction = null` in `interval_readings`

707 of 922 rows have `direction = null`. Household meters (1–5) should be `consumption`; production meters (9001–9003) should be `production`.

Hypha Platform normalizes null → consumption/production at read time as a workaround, but the feed should emit explicit directions.

### 4. Empty management tables

- `mgmt.communities` — 0 rows
- `mgmt.users` — 0 rows
- `GET /v1/communities` returns `[]`

Blocks REST-only UI integration (`/metrics`, community CRUD). Hypha Platform reads `interval_readings` directly from Postgres for charts until communities are populated or a telemetry endpoint is added.

**Request:** Either populate `mgmt.communities` / users, or add:

```text
GET /v1/communities/{id}/telemetry?period=day|week|month
```

returning aggregated consumption/production by source.

### 5. Community ID mapping

Azure data uses `community_id` values `0`, `1`, and `100`. The Base mainnet EnergyPPAv2 demo uses **factory community ID `0`**.

**Confirm:** Which `community_id` in Azure maps to which on-chain community / Hypha space?

### 6. Read-only user has write grants

`v2_vpp` was described as read-only sandbox, but holds `INSERT`, `UPDATE`, `DELETE` on all `mgmt` tables. Please restrict if unintended.

---

## Environment variables (Hypha Platform side)

Once blockers are resolved, configure:

| Variable | Purpose |
|---|---|
| `ENERGY_DB_HOST` | Azure Postgres host |
| `ENERGY_DB_DATABASE` | `hypha_v2` |
| `ENERGY_DB_USER` / `ENERGY_DB_PASSWORD` | DB credentials |
| `ENERGY_DB_COMMUNITY_ID` | Filter for interval_readings (default from on-chain activation) |
| `ENERGY_API_KEY` | `X-Api-Key` for `https://api.hypha.energy` |
| `ENERGY_PRICE_MARKET` | Spot market / country_price_area code (default `AT`) |
| `ENERGY_GRID_IMPORT_CT` / `ENERGY_GRID_EXPORT_CT` | Fallback grid prices in ct/kWh |

Legacy `ENERGY_RDS_*` env names remain supported in the VPP loop script.
