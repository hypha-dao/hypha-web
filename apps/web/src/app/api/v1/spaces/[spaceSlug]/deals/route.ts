import { NextRequest, NextResponse } from 'next/server';
import {
  createDeal,
  findDealsBySpaceId,
  schemaCreateDeal,
  schemaDealFiltersQuery,
  type DealFilters,
  type PipelineSwimlane,
  type PipelineStatus,
  type Region,
  type DealPriority,
  type DealStatus,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { assertPipelineWriteAccess, resolvePipelineSpace } from './_shared';

type Params = { spaceSlug: string };

function parseListParam<T extends string>(
  url: URL,
  key: string,
): T | T[] | undefined {
  const all = url.searchParams.getAll(key) as T[];
  if (all.length === 0) return undefined;
  if (all.length === 1) return all[0];
  return all;
}

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

    const url = new URL(request.url);
    const parsed = schemaDealFiltersQuery.safeParse({
      q: url.searchParams.get('q') ?? undefined,
      swimlane: parseListParam<PipelineSwimlane>(url, 'swimlane'),
      region: parseListParam<Region>(url, 'region'),
      country: parseListParam<string>(url, 'country'),
      priority: parseListParam<DealPriority>(url, 'priority'),
      status: parseListParam<DealStatus>(url, 'status'),
      pipelineStatus: parseListParam<PipelineStatus>(url, 'pipelineStatus'),
      ownerId: url.searchParams.get('ownerId') ?? undefined,
      accountManagerId: url.searchParams.get('accountManagerId') ?? undefined,
      tag: url.searchParams.get('tag') ?? undefined,
      hasDeadline: url.searchParams.get('hasDeadline') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid filters', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const filters = parsed.data as DealFilters;
    const data = await findDealsBySpaceId(
      { spaceId: space.id, filters },
      { db },
    );
    return NextResponse.json({ data });
  } catch (err) {
    console.error('[GET deals]', err);
    return NextResponse.json(
      { error: 'Failed to list deals' },
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
    const parsed = schemaCreateDeal.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid deal payload', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const created = await createDeal(
      {
        ...parsed.data,
        spaceId: space.id,
        ownerId: write.person.id,
      },
      { db },
    );
    return NextResponse.json({ data: created }, { status: 201 });
  } catch (err) {
    console.error('[POST deals]', err);
    return NextResponse.json(
      { error: 'Failed to create deal' },
      { status: 500 },
    );
  }
}
