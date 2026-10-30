import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  findEnergyCommunityBySpaceId,
  fetchEnergyTelemetry,
  isEnergyDbConfigured,
  parseEnergyTelemetryPeriod,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { checkSpaceAccess } from '@web/utils/check-space-access';
import {
  readStaleWhileRevalidate,
  StaleWhileRevalidateBusyError,
} from '@web/utils/stale-while-revalidate';

/** Pool worst case (15s connect + 70s query) plus space/access lookups. */
export const maxDuration = 90;

/**
 * Azure aggregates take 17–45s uncached. Readings land in 15-minute windows,
 * so serve the last aggregate and refresh it after the response once it is
 * older than this. Kept for a week so a quiet community still opens warm.
 */
const TELEMETRY_FRESH_MS = 5 * 60_000;
const TELEMETRY_CACHE_TTL_SECONDS = 7 * 24 * 60 * 60;

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

    const telemetry = await readStaleWhileRevalidate({
      key: `energy-telemetry:v1:${communityId}:${period}`,
      freshMs: TELEMETRY_FRESH_MS,
      ttlSeconds: TELEMETRY_CACHE_TTL_SECONDS,
      load: () => fetchEnergyTelemetry({ communityId, period }),
      // Parallel cold aggregates slow each other down past the query timeout,
      // so one instance per region queries Azure and the rest wait for it.
      coalesce: { waitMs: 55_000, lockSeconds: maxDuration },
    });

    return NextResponse.json(telemetry, {
      headers: {
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60',
      },
    });
  } catch (error) {
    if (error instanceof StaleWhileRevalidateBusyError) {
      return NextResponse.json(
        { error: 'Energy telemetry is still loading.' },
        { status: 503, headers: { 'Retry-After': '10' } },
      );
    }
    console.error('[spaces/energy/telemetry] failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch energy telemetry.' },
      { status: 500 },
    );
  }
}
