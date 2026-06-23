/**
 * VPP Fair-Split Settlement Engine — Type definitions
 *
 * Unit conventions:
 *   - Energy quantities: Wh (integer, matching interval_readings.energy_wh)
 *   - Ownership: basis points 0–10000 (integer, derived from on-chain token balances)
 *   - Prices: bigint, contract-native uint256 values (basePricePerKwh from on-chain)
 *   - Contract charge: quantity * pricePerKwh (uint256, interpretation depends on deployment)
 */

// ── Input: TimescaleDB aggregation ──────────────────────────────────────────

/** Row from the interval_readings table (TimescaleDB aggregation output). */
export interface IntervalReading {
  interval_start: string;
  meter_id: number;
  community_id: number;
  energy_wh: number;
  /** Null appears in Azure sandbox rows for household meters; normalize before VPP. */
  direction: 'consumption' | 'production' | 'import' | null;
}

// ── On-chain configuration ──────────────────────────────────────────────────

/** Energy source configuration with ownership snapshot. */
export interface SourceInfo {
  sourceId: string; // bytes32 hex
  sourceType: 'SOLAR' | 'BATTERY';
  basePricePerKwh: bigint;
  ownershipToken: string; // ERC-20 address
  ownershipBps: Map<string, number>; // memberAddress -> basis points (0–10000)
}

/** Community member from on-chain registry. */
export interface MemberInfo {
  address: string;
  deviceIds: number[];
  isActive: boolean;
}

/** Full on-chain state snapshot needed by the VPP. */
export interface OnChainConfig {
  contractAddress: string;
  sources: SourceInfo[];
  members: MemberInfo[];
  exportDeviceId: number;
  communityFeeBps: number;
  aggregatorFeeBps: number;
  deviceToMember: Map<number, string>; // deviceId -> memberAddress
}

/** VPP-specific configuration not stored on-chain. */
export interface VppConfig {
  /** Maps production meter IDs to on-chain source IDs. */
  productionDeviceToSource: Map<number, string>;
}

// ── Fair-split algorithm I/O ────────────────────────────────────────────────

export interface FairSplitInput {
  /** All member addresses (including pure investors with 0 consumption). */
  members: string[];
  /** Member address -> Wh consumed. Missing entries default to 0. */
  consumption: Map<string, number>;
  /** Source ID -> Wh produced this interval. */
  production: Map<string, number>;
  /** Source configs with ownership; will be sorted by price ascending. */
  sources: SourceInfo[];
  gridImportPrice: bigint;
  gridExportPrice: bigint;
}

export interface SourceAllocation {
  sourceId: string;
  usedWh: number;
}

export interface MemberAllocation {
  memberAddress: string;
  consumptionWh: number;
  sourceAllocations: SourceAllocation[];
  gridImportWh: number;
}

export interface ExportAllocation {
  sourceId: string;
  exportWh: number;
}

export interface FairSplitResult {
  allocations: MemberAllocation[];
  exports: ExportAllocation[];
  totalGridImportWh: number;
  totalExportWh: number;
}

// ── Algorithm trace (optional debug instrumentation) ────────────────────────

export type TraceEvent =
  | Pass1MemberTrace
  | Pass1SummaryTrace
  | Pass2SourceStartTrace
  | Pass2IterationTrace
  | Pass2SourceEndTrace
  | Pass3Trace
  | ExportTrace;

export interface Pass1MemberTrace {
  type: 'pass1_member';
  member: string;
  source: string;
  production: number;
  bps: number;
  share: number;
  used: number;
  surplus: number;
  remainingBefore: number;
  remainingAfter: number;
}

export interface Pass1SummaryTrace {
  type: 'pass1_summary';
  deficits: Array<{ member: string; deficit: number }>;
  surplusPools: Array<{ source: string; pool: number }>;
}

export interface Pass2SourceStartTrace {
  type: 'pass2_source_start';
  source: string;
  pool: number;
  weightSource: string;
  isFallback: boolean;
}

export interface Pass2IterationTrace {
  type: 'pass2_iteration';
  source: string;
  iteration: number;
  eligible: Array<{
    member: string;
    weight: number;
    alloc: number;
    deficitBefore: number;
    extra: number;
    deficitAfter: number;
    hitCap: boolean;
  }>;
  totalWeight: number;
  poolBefore: number;
  distributed: number;
  poolAfter: number;
}

export interface Pass2SourceEndTrace {
  type: 'pass2_source_end';
  source: string;
  deficits: Array<{ member: string; deficit: number }>;
}

export interface Pass3Trace {
  type: 'pass3';
  imports: Array<{ member: string; gridImportWh: number }>;
}

export interface ExportTrace {
  type: 'export';
  exports: Array<{ source: string; exportWh: number }>;
}

export type TraceFn = (event: TraceEvent) => void;

// ── Contract output ─────────────────────────────────────────────────────────

/**
 * Matches the Solidity struct EnergyPPAv2.ConsumptionReading.
 *
 * The contract computes `charge = quantity * pricePerKwh` in internal units
 * where 1 internal unit = 10,000 stablecoin base units (= 1 cent for EURC).
 */
export interface ConsumptionReading {
  deviceId: bigint;
  quantity: bigint;
  pricePerKwh: bigint;
  sourceId: string; // bytes32 hex
}
