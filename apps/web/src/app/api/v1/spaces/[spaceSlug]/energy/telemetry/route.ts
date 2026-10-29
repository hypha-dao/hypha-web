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

/** Azure PG connect + windowed aggregate can exceed the 15s default. */
export const maxDuration = 60;

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

    const [access, mapping] = await Promise.all([
      checkSpaceAccess(request, space.web3SpaceId as number),
      findEnergyCommunityBySpaceId(space.id, { db }),
    ]);
    if (!access.hasAccess) {
      const status = access.response?.status;
      if (status === 401 || status === 403 || !access.response) {
        return (
          access.response ??
          NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        );
      }
      console.warn(
        `[spaces/energy/telemetry] checkSpaceAccess returned ${status} — falling through.`,
      );
    }

    if (!mapping) {
      return NextResponse.json(disabledTelemetryPayload(period));
    }

    if (mapping.factoryCommunityId == null) {
      return NextResponse.json(disabledTelemetryPayload(period));
    }

    const communityId = mapping.factoryCommunityId;

    const telemetry = await fetchEnergyTelemetry({
      communityId,
      period,
    });

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
