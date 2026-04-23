import { keccak256, toUtf8Bytes } from 'ethers';
import type {
  ConsumptionReading,
  FairSplitResult,
  MemberInfo,
  SourceInfo,
} from './types';

export const IMPORT_SOURCE_ID = keccak256(toUtf8Bytes('IMPORT'));

/**
 * Transform the fair-split algorithm output into a flat ConsumptionReading[]
 * suitable for the EnergyPPAv2.consumeEnergy() contract call.
 *
 * One reading is generated per (member, source) pair where usedWh > 0,
 * plus one reading per member for grid import (if any), plus one reading
 * per source for export (if any).
 *
 * @param quantityScale  Divisor applied to Wh quantities before passing to the
 *                       contract. Default 1 (pass Wh directly). Set to 1000 to
 *                       convert Wh → kWh for contracts using kWh-based pricing.
 */
export function buildConsumptionReadings(
  result: FairSplitResult,
  sources: SourceInfo[],
  members: MemberInfo[],
  exportDeviceId: number,
  gridImportPrice: bigint,
  gridExportPrice: bigint,
  quantityScale: number = 1,
): ConsumptionReading[] {
  const sourceMap = new Map(sources.map((s) => [s.sourceId, s]));
  const memberDeviceMap = buildMemberDeviceMap(members);

  const readings: ConsumptionReading[] = [];

  for (const alloc of result.allocations) {
    const deviceId = memberDeviceMap.get(alloc.memberAddress);
    if (deviceId === undefined) {
      throw new Error(`No device ID found for member ${alloc.memberAddress}`);
    }

    for (const sa of alloc.sourceAllocations) {
      const source = sourceMap.get(sa.sourceId);
      if (!source) {
        throw new Error(`Unknown source ${sa.sourceId}`);
      }

      const quantity = scaleQuantity(sa.usedWh, quantityScale);
      if (quantity > 0n) {
        readings.push({
          deviceId: BigInt(deviceId),
          quantity,
          pricePerKwh: source.basePricePerKwh,
          sourceId: sa.sourceId,
        });
      }
    }

    if (alloc.gridImportWh > 0) {
      const quantity = scaleQuantity(alloc.gridImportWh, quantityScale);
      if (quantity > 0n) {
        readings.push({
          deviceId: BigInt(deviceId),
          quantity,
          pricePerKwh: gridImportPrice,
          sourceId: IMPORT_SOURCE_ID,
        });
      }
    }
  }

  for (const exp of result.exports) {
    const source = sourceMap.get(exp.sourceId);
    if (!source) {
      throw new Error(`Unknown export source ${exp.sourceId}`);
    }

    const quantity = scaleQuantity(exp.exportWh, quantityScale);
    if (quantity > 0n) {
      readings.push({
        deviceId: BigInt(exportDeviceId),
        quantity,
        pricePerKwh: gridExportPrice,
        sourceId: exp.sourceId,
      });
    }
  }

  return readings;
}

function scaleQuantity(wh: number, scale: number): bigint {
  if (scale === 1) return BigInt(wh);
  return BigInt(Math.floor(wh / scale));
}

/**
 * Pick the first device ID for each member. The contract routes by deviceId → member,
 * so any of the member's devices will resolve to the correct address.
 */
function buildMemberDeviceMap(members: MemberInfo[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of members) {
    if (m.deviceIds.length > 0) {
      map.set(m.address, m.deviceIds[0]);
    }
  }
  return map;
}
