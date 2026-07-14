import { keccak256, toUtf8Bytes } from 'ethers';
import type {
  ConsumptionReading,
  FairSplitResult,
  MemberInfo,
  SourceInfo,
} from './types';

export const IMPORT_SOURCE_ID = keccak256(toUtf8Bytes('IMPORT'));

/** Wh per kWh — used when converting meter Wh to contract charge (ct). */
export const WH_PER_KWH = 1000n;

/**
 * Map meter Wh + ct/kWh price to contract `{ quantity, pricePerKwh }`.
 *
 * Contract charge is always `quantity * pricePerKwh` (euro cents). Meter data
 * is in Wh, prices in ct/kWh, so the target charge is `floor(wh * price / 1000)`.
 *
 * - Exact whole-kWh amounts use kWh encoding (`quantity=kWh`, `price=ct/kWh`).
 * - Other positive charges use `{ quantity: 1, pricePerKwh: chargeCt }`.
 * - Sub-cent slices round up to 1 ct so small intervals (e.g. 20 Wh) still settle.
 */
export function encodeContractQuantityPrice(
  usedWh: number,
  pricePerKwhCt: bigint,
  whPerKwh: bigint = WH_PER_KWH,
): { quantity: bigint; pricePerKwh: bigint } | null {
  if (usedWh <= 0) return null;
  if (pricePerKwhCt <= 0n) {
    throw new Error('pricePerKwh must be > 0');
  }

  const wh = BigInt(usedWh);
  let chargeCt = (wh * pricePerKwhCt) / whPerKwh;
  if (chargeCt === 0n) {
    chargeCt = (wh * pricePerKwhCt + whPerKwh - 1n) / whPerKwh;
  }
  if (chargeCt === 0n) return null;

  const wholeKwh = wh / whPerKwh;
  if (wholeKwh > 0n && wh % whPerKwh === 0n) {
    return { quantity: wholeKwh, pricePerKwh: pricePerKwhCt };
  }

  return { quantity: 1n, pricePerKwh: chargeCt };
}

/**
 * Transform the fair-split algorithm output into a flat ConsumptionReading[]
 * suitable for the EnergyPPAv2.consumeEnergy() contract call.
 *
 * One reading is generated per (member, source) pair where usedWh > 0,
 * plus one reading per member for grid import (if any), plus one reading
 * per source for export (if any).
 *
 * @param quantityScale  Wh per kWh divisor for charge math (default 1000).
 *                       Kept for backwards compatibility with callers that
 *                       previously passed `QUANTITY_SCALE = 1000`.
 */
export function buildConsumptionReadings(
  result: FairSplitResult,
  sources: SourceInfo[],
  members: MemberInfo[],
  exportDeviceId: number,
  gridImportPrice: bigint,
  gridExportPrice: bigint,
  quantityScale: number = 1000,
): ConsumptionReading[] {
  const whPerKwh = BigInt(quantityScale > 0 ? quantityScale : 1000);
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

      const encoded = encodeContractQuantityPrice(
        sa.usedWh,
        source.basePricePerKwh,
        whPerKwh,
      );
      if (encoded) {
        readings.push({
          deviceId: BigInt(deviceId),
          quantity: encoded.quantity,
          pricePerKwh: encoded.pricePerKwh,
          sourceId: sa.sourceId,
        });
      }
    }

    if (alloc.gridImportWh > 0) {
      const encoded = encodeContractQuantityPrice(
        alloc.gridImportWh,
        gridImportPrice,
        whPerKwh,
      );
      if (encoded) {
        readings.push({
          deviceId: BigInt(deviceId),
          quantity: encoded.quantity,
          pricePerKwh: encoded.pricePerKwh,
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

    const encoded = encodeContractQuantityPrice(
      exp.exportWh,
      gridExportPrice,
      whPerKwh,
    );
    if (encoded) {
      readings.push({
        deviceId: BigInt(exportDeviceId),
        quantity: encoded.quantity,
        pricePerKwh: encoded.pricePerKwh,
        sourceId: exp.sourceId,
      });
    }
  }

  return readings;
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
