import { NextRequest, NextResponse } from 'next/server';
import {
  createPipelineSavedView,
  findPipelineSavedViews,
  schemaCreatePipelineSavedView,
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

    const data = await findPipelineSavedViews(
      { spaceId: space.id, personId: write.person.id },
      { db },
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET pipeline saved-views]', err);
    return NextResponse.json(
      { error: 'Failed to list saved views' },
      { status: 500 },
    );
  }
}

export async function POST(
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
    const parsed = schemaCreatePipelineSavedView.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid saved view', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const created = await createPipelineSavedView(
      {
        spaceId: space.id,
        personId: write.person.id,
        ...parsed.data,
      },
      { db },
    );
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[POST pipeline saved-views]', err);
    return NextResponse.json(
      { error: 'Failed to create saved view' },
      { status: 500 },
    );
  }
}
