import { NextRequest, NextResponse } from 'next/server';
import {
  findSpaceBySlug,
  readPipelineConfig,
  schemaPipelineConfig,
  updatePipelineConfig,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { assertPipelineWriteAccess } from '../../deals/_shared';

type Params = { spaceSlug: string };

async function resolveSpace(spaceSlug: string) {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) {
    return {
      space: null,
      error: NextResponse.json({ error: 'Space not found' }, { status: 404 }),
    };
  }
  return { space, error: null };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug } = await params;
  try {
    const { space, error } = await resolveSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error) return write.error;

    const data = await readPipelineConfig({ spaceId: space.id }, { db });
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET pipeline config]', err);
    return NextResponse.json(
      { error: 'Failed to get pipeline config' },
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
    const { space, error } = await resolveSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error) return write.error;

    const body = await request.json();
    const parsed = schemaPipelineConfig.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid pipeline config', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const data = await updatePipelineConfig(
      { spaceId: space.id, config: parsed.data },
      { db },
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[PUT pipeline config]', err);
    return NextResponse.json(
      { error: 'Failed to save pipeline config' },
      { status: 500 },
    );
  }
}
