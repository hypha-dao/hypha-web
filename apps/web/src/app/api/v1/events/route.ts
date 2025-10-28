import { NextRequest, NextResponse } from 'next/server';
import { findAllEvents } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { EVENT_ENTITY_TYPES, EventEntity } from '@hypha-platform/core/client';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
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
  const referenceEntity = (() => {
    return EVENT_ENTITY_TYPES.includes(referenceEntityRaw as EventEntity)
      ? (referenceEntityRaw as EventEntity)
      : undefined;
  })();

  try {
    const events = await findAllEvents(
      { db },
      { type, referenceId, referenceEntity },
    );

    return NextResponse.json(events);
  } catch (error) {
    console.error('Failed to fetch tokens:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tokens' },
      { status: 500 },
    );
  }
}
