import { NextRequest, NextResponse } from 'next/server';
import {
  deletePipelineSavedViewById,
  schemaUpdatePipelineSavedView,
  updatePipelineSavedViewById,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  assertPipelineWriteAccess,
  resolvePipelineSpace,
} from '../../../deals/_shared';

type Params = { spaceSlug: string; viewId: string };

function parseId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, viewId: viewIdRaw } = await params;
  try {
    const { space, error } = await resolvePipelineSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error || !write.person) return write.error!;

    const viewId = parseId(viewIdRaw);
    if (!viewId) {
      return NextResponse.json({ error: 'Invalid view id' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = schemaUpdatePipelineSavedView.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid saved view', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await updatePipelineSavedViewById(
      {
        id: viewId,
        spaceId: space.id,
        personId: write.person.id,
        ...parsed.data,
      },
      { db },
    );
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH pipeline saved-view]', err);
    const message =
      err instanceof Error ? err.message : 'Failed to update saved view';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, viewId: viewIdRaw } = await params;
  try {
    const { space, error } = await resolvePipelineSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error || !write.person) return write.error!;

    const viewId = parseId(viewIdRaw);
    if (!viewId) {
      return NextResponse.json({ error: 'Invalid view id' }, { status: 400 });
    }

    await deletePipelineSavedViewById(
      {
        id: viewId,
        spaceId: space.id,
        personId: write.person.id,
      },
      { db },
    );
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE pipeline saved-view]', err);
    const message =
      err instanceof Error ? err.message : 'Failed to delete saved view';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
