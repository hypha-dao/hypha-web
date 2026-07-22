import { NextRequest, NextResponse } from 'next/server';
import {
  deleteDealById,
  findDealById,
  schemaUpdateDeal,
  updateDealById,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { assertPipelineWriteAccess, resolvePipelineSpace } from '../_shared';

type Params = { spaceSlug: string; dealId: string };

function parseDealId(raw: string): number | null {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, dealId: dealIdRaw } = await params;
  try {
    const { space, error } = await resolvePipelineSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error) return write.error;

    const dealId = parseDealId(dealIdRaw);
    if (!dealId) {
      return NextResponse.json({ error: 'Invalid deal id' }, { status: 400 });
    }

    const deal = await findDealById({ id: dealId, spaceId: space.id }, { db });
    if (!deal) {
      return NextResponse.json({ error: 'Deal not found' }, { status: 404 });
    }
    return NextResponse.json({ data: deal });
  } catch (err) {
    console.error('[GET deal]', err);
    return NextResponse.json({ error: 'Failed to get deal' }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, dealId: dealIdRaw } = await params;
  try {
    const { space, error } = await resolvePipelineSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error) return write.error;

    const dealId = parseDealId(dealIdRaw);
    if (!dealId) {
      return NextResponse.json({ error: 'Invalid deal id' }, { status: 400 });
    }

    const body = await request.json();
    const parsed = schemaUpdateDeal.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid deal payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const updated = await updateDealById(
      { id: dealId, spaceId: space.id, ...parsed.data },
      { db },
    );
    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error('[PATCH deal]', err);
    const message =
      err instanceof Error ? err.message : 'Failed to update deal';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { spaceSlug, dealId: dealIdRaw } = await params;
  try {
    const { space, error } = await resolvePipelineSpace(spaceSlug);
    if (error || !space) return error!;

    const write = await assertPipelineWriteAccess(spaceSlug, request);
    if (write.error) return write.error;

    const dealId = parseDealId(dealIdRaw);
    if (!dealId) {
      return NextResponse.json({ error: 'Invalid deal id' }, { status: 400 });
    }

    await deleteDealById({ id: dealId, spaceId: space.id }, { db });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[DELETE deal]', err);
    const message =
      err instanceof Error ? err.message : 'Failed to delete deal';
    const status = message.includes('not found') ? 404 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
