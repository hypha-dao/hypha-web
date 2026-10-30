import { NextRequest, NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import {
  findSpaceBySlug,
  findEnergyCommunityBySpaceId,
  fetchEnergyTelemetry,
  isEnergyDbConfigured,
  parseEnergyTelemetryPeriod,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';

/** Pool worst case (15s connect + 45s query) plus space/access lookups. */
export const maxDuration = 90;

type TelemetryPeriod = ReturnType<typeof parseEnergyTelemetryPeriod>;

/**
 * Azure aggregates take 17–30s uncached. Readings land in 15-minute windows,
 * so serve the last aggregate from the shared Data Cache and refresh it in
 * the background once it is older than this.
 */
const TELEMETRY_REVALIDATE_SECONDS = 300;

const readCachedTelemetry = unstable_cache(
  (communityId: number, period: TelemetryPeriod) =>
    fetchEnergyTelemetry({ communityId, period }),
  ['energy-telemetry-v1'],
  { revalidate: TELEMETRY_REVALIDATE_SECONDS, tags: ['energy-telemetry'] },
);

const disabledTelemetryPayload = (
  period: ReturnType<typeof parseEnergyTelemetryPeriod>,
) => ({
  enabled: false,
  configured: isEnergyDbConfigured(),
  period,
  labels: [],
  consumptionKwh: [],
  consumptionByMeter: [],
  productionBySource: [],
  gridImportKwh: [],
  gridExportKwh: [],
  totals: {
    producedKwh: 0,
    consumedKwh: 0,
    netKwh: 0,
    gridImportedKwh: 0,
    gridExportedKwh: 0,
  },
  dataFrom: null,
  dataTo: null,
  communityId: null,
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  const { spaceSlug } = await params;
  const period = parseEnergyTelemetryPeriod(
    request.nextUrl.searchParams.get('period'),
  );

  try {
    const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
    if (!space) {
      return NextResponse.json({ error: 'Space not found' }, { status: 404 });
    }

    if (space.web3SpaceId == null) {
      return NextResponse.json(disabledTelemetryPayload(period));
    }

    const access = await checkSpaceAccess(request, space.web3SpaceId as number);
    if (!access.hasAccess) {
      return (
        access.response ??
        NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      );
    }

    const mapping = await findEnergyCommunityBySpaceId(space.id, { db });
    if (!mapping) {
      return NextResponse.json(disabledTelemetryPayload(period));
    }

    if (mapping.factoryCommunityId == null) {
      return NextResponse.json(disabledTelemetryPayload(period));
    }

    const communityId = mapping.factoryCommunityId;

    if (!isEnergyDbConfigured()) {
      return NextResponse.json(
        await fetchEnergyTelemetry({ communityId, period }),
      );
    }

    const telemetry = await readCachedTelemetry(communityId, period);

    return NextResponse.json(telemetry, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    console.error('[spaces/energy/telemetry] failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch energy telemetry.' },
      { status: 500 },
    );
  }
}
