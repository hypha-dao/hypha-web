import type { Provider } from 'ethers';
import type {
  IntervalReading,
  ConsumptionReading,
  FairSplitInput,
  OnChainConfig,
  VppConfig,
} from './types';
import { fairSplit } from './fair-split';
import { buildConsumptionReadings } from './build-readings';
import { readOnChainConfig } from './on-chain-reader';

export interface GridPrices {
  importPricePerKwh: bigint;
  exportPricePerKwh: bigint;
}

export interface RunIntervalOptions {
  /**
   * Wh per kWh used when converting meter Wh to contract charge.
   * Default 1000 (standard). Passed through to `buildConsumptionReadings`.
   */
  quantityScale?: number;
}

/**
 * Process one 15-minute interval: read on-chain state, run the fair-split
 * algorithm, and produce the ConsumptionReading[] ready for consumeEnergy().
 *
 * Does NOT submit the transaction — the caller decides whether to send or dry-run.
 */
export async function runInterval(
  intervalReadings: IntervalReading[],
  provider: Provider,
  contractAddress: string,
  vppConfig: VppConfig,
  gridPrices: GridPrices,
  options: RunIntervalOptions = {},
): Promise<ConsumptionReading[]> {
  const { quantityScale = 1000 } = options;

  const onChainConfig = await readOnChainConfig(provider, contractAddress);

  return runIntervalWithConfig(
    intervalReadings,
    onChainConfig,
    vppConfig,
    gridPrices,
    { quantityScale },
  );
}

/**
 * Same as runInterval but accepts a pre-fetched OnChainConfig.
 * Useful for testing or when caching on-chain state.
 */
export function runIntervalWithConfig(
  intervalReadings: IntervalReading[],
  onChainConfig: OnChainConfig,
  vppConfig: VppConfig,
  gridPrices: GridPrices,
  options: RunIntervalOptions = {},
): ConsumptionReading[] {
  const { quantityScale = 1000 } = options;
  const { sources, members, exportDeviceId } = onChainConfig;

  const { consumption, production } = parseIntervalReadings(
    intervalReadings,
    onChainConfig,
    vppConfig,
  );

  const input: FairSplitInput = {
    members: members.filter((m) => m.isActive).map((m) => m.address),
    consumption,
    production,
    sources,
    gridImportPrice: gridPrices.importPricePerKwh,
    gridExportPrice: gridPrices.exportPricePerKwh,
  };

  const result = fairSplit(input);

  return buildConsumptionReadings(
    result,
    sources,
    members,
    exportDeviceId,
    gridPrices.importPricePerKwh,
    gridPrices.exportPricePerKwh,
    quantityScale,
  );
}

/**
 * Parse interval readings into consumption and production maps.
 *
 * - consumption readings: keyed by member address (resolved via deviceToMember)
 * - production readings: keyed by source ID (resolved via productionDeviceToSource)
 * - import readings: ignored by the algorithm (grid import is computed as residual deficit)
 *   but validated against the computed result if present
 */
function parseIntervalReadings(
  readings: IntervalReading[],
  onChainConfig: OnChainConfig,
  vppConfig: VppConfig,
): { consumption: Map<string, number>; production: Map<string, number> } {
  const consumption = new Map<string, number>();
  const production = new Map<string, number>();

  for (const reading of readings) {
    switch (reading.direction) {
      case 'consumption': {
        const memberAddr = onChainConfig.deviceToMember.get(reading.meter_id);
        if (!memberAddr) {
          throw new Error(
            `Consumption meter ${reading.meter_id} not mapped to any member`,
          );
        }
        consumption.set(
          memberAddr,
          (consumption.get(memberAddr) ?? 0) + reading.energy_wh,
        );
        break;
      }
      case 'production': {
        const sourceId = vppConfig.productionDeviceToSource.get(
          reading.meter_id,
        );
        if (!sourceId) {
          throw new Error(
            `Production meter ${reading.meter_id} not mapped to any source`,
          );
        }
        production.set(
          sourceId,
          (production.get(sourceId) ?? 0) + reading.energy_wh,
        );
        break;
      }
      case 'import':
        // Grid import readings are informational — the VPP computes import
        // as the residual deficit. These can be used for validation downstream.
        break;
    }
  }

  return { consumption, production };
}
