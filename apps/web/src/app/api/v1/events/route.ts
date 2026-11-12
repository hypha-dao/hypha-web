import { NextRequest, NextResponse } from 'next/server';
import { findAllEvents } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { EVENT_ENTITY_TYPES, EventEntity } from '@hypha-platform/core/client';
import {
  findDocumentSpaceId,
  resolveMappedHostScope,
} from '../../../../lib/white-label/mapped-host-scope';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  // Mapped host (Space header set by middleware): events of the host's own
  // Space only. No header means the main app, which continues below unchanged.
  try {
    const scope = await resolveMappedHostScope(request);
    if (scope.kind !== 'main') {
      const entity = searchParams.get('referenceEntity');
      const idRaw = searchParams.get('referenceId');
      if (
        !entity ||
        !idRaw ||
        !/^\d{1,9}$/.test(idRaw) ||
        !EVENT_ENTITY_TYPES.includes(entity as EventEntity)
      ) {
        return NextResponse.json(
          { error: 'referenceEntity and a numeric referenceId are required' },
          { status: 400 },
        );
      }
      if (scope.kind !== 'mapped')
        return new NextResponse(null, { status: 404 });
      const id = Number(idRaw);
      // `person` and `token` events are not served on a mapped host.
      const allowed =
        entity === 'space'
          ? id === scope.spaceId
          : entity === 'document'
          ? (await findDocumentSpaceId({ id })) === scope.spaceId
          : false;
      if (!allowed) return new NextResponse(null, { status: 404 });
    }
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 },
    );
  }
  const type = searchParams.get('type') || undefined;
  const referenceIdRaw = searchParams.get('referenceId') || undefined;
  const referenceId = (() => {
    if (!referenceIdRaw) {
      return undefined;
    }
    try {
      return Number.parseInt(referenceIdRaw);
    } catch {
      return undefined;
    }
  })();
  const referenceEntityRaw = searchParams.get('referenceEntity') || undefined;
  const referenceEntity = EVENT_ENTITY_TYPES.includes(
    referenceEntityRaw as EventEntity,
  )
    ? (referenceEntityRaw as EventEntity)
    : undefined;

  try {
    const events = await findAllEvents(
      { db },
      { type, referenceId, referenceEntity },
    );

    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 },
    );
  }
}
