import { NextRequest, NextResponse } from 'next/server';
import {
  readPipelineConfig,
  schemaPipelineConfig,
  updatePipelineConfig,
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
    const { space, error } = await resolvePipelineSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error) return write.error;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
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
