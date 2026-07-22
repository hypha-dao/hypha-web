import { NextRequest, NextResponse } from 'next/server';
import {
  findPipelineUserSettings,
  schemaPipelineUserSettings,
  upsertPipelineUserSettings,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  assertPipelineWriteAccess,
  resolvePipelineSpace,
} from '../../deals/_shared';

type Params = { spaceSlug: string };

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const { space, error } = await resolvePipelineSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error || !write.person) return write.error!;

    const data = await findPipelineUserSettings(
      { spaceId: space.id, personId: write.person.id },
      { db },
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET pipeline settings]', err);
    return NextResponse.json(
      { error: 'Failed to get pipeline settings' },
      { status: 500 },
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const { space, error } = await resolvePipelineSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error || !write.person) return write.error!;

    const body = await request.json();
    const parsed = schemaPipelineUserSettings.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid settings', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = await upsertPipelineUserSettings(
      {
        spaceId: space.id,
        personId: write.person.id,
        countryFocus: parsed.data.countryFocus.map((c) => c.toUpperCase()),
      },
      { db },
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[PUT pipeline settings]', err);
    return NextResponse.json(
      { error: 'Failed to save pipeline settings' },
      { status: 500 },
    );
  }
}
