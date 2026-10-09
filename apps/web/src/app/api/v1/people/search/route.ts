import {
  resolveMemberCaller,
  searchNetworkPeople,
} from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const query = request.nextUrl.searchParams.get('q')?.trim() ?? '';
  if (query.length < 2) {
    return NextResponse.json({ people: [] });
  }

  try {
    const caller = await resolveMemberCaller(authToken);
    if (!caller?.person.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const people = await searchNetworkPeople(
      { query, excludePersonId: caller.person.id },
      { db: caller.db },
    );
    return NextResponse.json({ people });
  } catch (error) {
    console.error('Error searching people:', error);
    return NextResponse.json(
      { error: 'Failed to search people' },
      { status: 500 },
    );
  }
}
