import {
  getMemberIntelligence,
  resolveMemberCaller,
} from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Same caller as the member MCP: Privy user id → people.sub, then that
    // row's own database. Do not reuse a numeric id from a different connection.
    const caller = await resolveMemberCaller(authToken);
    if (!caller?.person.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const intelligence = await getMemberIntelligence(
      { personId: caller.person.id },
      { db: caller.db },
    );
    if (!intelligence) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(intelligence);
  } catch (error) {
    console.error('Error loading member intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to load member intelligence' },
      { status: 500 },
    );
  }
}
