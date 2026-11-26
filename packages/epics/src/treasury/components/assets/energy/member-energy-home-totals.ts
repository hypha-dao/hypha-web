import type { SpaceEnergyResponse } from '../../../hooks/use-space-energy';

export type HomeEnergySeries = {
  makeIsHome: boolean;
  useIsHome: boolean;
  paired: boolean;
  make: number[];
  use: number[];
};

const sumBuckets = (series: { values: number[] }[]) => {
  const length = Math.max(0, ...series.map((item) => item.values.length));
  return Array.from({ length }, (_, index) =>
    series.reduce((total, item) => total + (item.values[index] ?? 0), 0),
  );
};

/**
 * Personal energy series for the signed-in member.
 *
 * Make = ownership share of each production source.
 * Use = meters linked to that member.
 * Never fall back to community totals for "You …" figures — zeros stay zeros
 * until the member's ownership / meters are known.
 */
export function homeTotals(
  data: SpaceEnergyResponse,
  address: string | undefined,
  production: { values: number[] }[],
  consumptionByMeter: { meterId: number; valuesKwh: number[] }[],
): HomeEnergySeries {
  const empty = Array.from(
    {
      length: Math.max(
        0,
        ...production.map((item) => item.values.length),
        ...consumptionByMeter.map((item) => item.valuesKwh.length),
      ),
    },
    () => 0,
  );

  const member = address
    ? data.memberDetails?.find(
        (detail) => detail.address.toLowerCase() === address.toLowerCase(),
      )
    : undefined;

  if (!member) {
    return {
      makeIsHome: false,
      useIsHome: false,
      paired: false,
      make: empty,
      use: empty,
    };
  }

  const ownership = new Map(
    (member.ownerships ?? []).map((item) => [
      item.sourceId.toLowerCase(),
      item.ownershipBps,
    ]),
  );
  const make = production.map((source, index) => {
    const registered = data.sources?.[index];
    const bps = registered
      ? ownership.get(registered.sourceId.toLowerCase()) ?? 0
      : 0;
    return (source.values ?? []).map((value) => (value * bps) / 10000);
  });
  const made = sumBuckets(make.map((values) => ({ values })));

  const meterIds = new Set(member.deviceIds ?? []);
  const usedBuckets = consumptionByMeter.filter((meter) =>
    meterIds.has(meter.meterId),
  );
  const used = sumBuckets(
    usedBuckets.map((meter) => ({ values: meter.valuesKwh })),
  );

  const hasMake = made.some((value) => value > 0) || ownership.size > 0;
  const hasUse = usedBuckets.length > 0;

  return {
    makeIsHome: hasMake,
    useIsHome: hasUse,
    paired: hasMake && hasUse,
    make: hasMake ? made : empty,
    use: hasUse ? used : empty,
  };
}
