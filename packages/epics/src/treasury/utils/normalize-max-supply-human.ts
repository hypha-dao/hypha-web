/**
 * DB `max_supply` and some payloads store human counts, but legacy or synced rows
 * may store wei-scale integers (×10^18). Values ≥ 1e15 are treated as wei and
 * divided so forms and `formatCurrencyValue` stay in human units.
 */
const WEI_SCALE = 1e18;
/** Below this, treat as already human (avoids scaling 1e18 → 1). */
const MIN_RAW_AS_WEI = 1e15;

export function normalizeMaxSupplyHuman(raw: number): number {
  if (!Number.isFinite(raw) || raw <= 0) {
    return 0;
  }
  if (raw < MIN_RAW_AS_WEI) {
    return raw;
  }
  return raw / WEI_SCALE;
}
