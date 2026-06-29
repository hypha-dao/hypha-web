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
      return NextResponse.json({
        enabled: false,
        configured: isEnergyDbConfigured(),
        period,
        labels: [],
        consumptionKwh: [],
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
    }

    const access = await checkSpaceAccess(request, space.web3SpaceId as number);
    if (!access.hasAccess && access.response) {
      const status = access.response.status;
      if (status === 401 || status === 403) {
        return access.response;
      }
    }

    const mapping = await findEnergyCommunityBySpaceId(space.id, { db });
    if (!mapping) {
      return NextResponse.json({
        enabled: false,
        configured: isEnergyDbConfigured(),
        period,
        labels: [],
        consumptionKwh: [],
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
    }

    const communityId =
      mapping.factoryCommunityId != null ? mapping.factoryCommunityId : 0;

    const telemetry = await fetchEnergyTelemetry({
      communityId,
      period,
    });

    return NextResponse.json(telemetry);
  } catch (error) {
    console.error('[spaces/energy/telemetry] failed:', error);
    return NextResponse.json(
      { error: 'Failed to fetch energy telemetry.' },
      { status: 500 },
    );
  }
}
