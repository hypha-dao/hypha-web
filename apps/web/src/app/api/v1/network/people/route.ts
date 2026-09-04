import { NextRequest, NextResponse } from 'next/server';
import { db } from '@hypha-platform/storage-postgres';
import {
  findNetworkVisiblePeopleBySpaceSlugs,
  resolvePersonFromAuthToken,
} from '@hypha-platform/core/server';

function parsePositiveInt(value: string | null, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export async function GET(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  const caller = await resolvePersonFromAuthToken(authToken);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const spaceSlugs = (request.nextUrl.searchParams.get('spaceSlugs') ?? '')
    .split(',')
    .map((slug) => slug.trim())
    .filter(Boolean);
  const excludeSlug =
    request.nextUrl.searchParams.get('excludeSlug')?.trim() ||
    caller.slug ||
    null;
  const searchTerm = request.nextUrl.searchParams.get('search')?.trim() || '';
  const page = parsePositiveInt(request.nextUrl.searchParams.get('page'), 1);
  const pageSize = Math.min(
    parsePositiveInt(request.nextUrl.searchParams.get('pageSize'), 20),
    40,
  );

  try {
    const response = await findNetworkVisiblePeopleBySpaceSlugs(
      {
        spaceSlugs,
        excludeSlug,
        searchTerm: searchTerm || undefined,
        callerPersonId: caller.id,
        pagination: { page, pageSize },
      },
      { db },
    );
    return NextResponse.json(response);
  } catch (error) {
    console.error('[network/people] Failed to list people:', error);
    return NextResponse.json(
      { error: 'Failed to list people' },
      { status: 500 },
    );
  }
}
