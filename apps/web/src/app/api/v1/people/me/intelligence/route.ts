import {
  getMemberIntelligence,
  resolveMemberCaller,
} from '@hypha-platform/core/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/** Stop before the preview/prod function 504 (~40s) so Home can render. */
const INTELLIGENCE_DEADLINE_MS = 12_000;

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

    const rawConnections = request.nextUrl.searchParams.get('connections');
    const requested =
      rawConnections == null ? undefined : Number(rawConnections);
    const connectionQuery = request.nextUrl.searchParams.get('q')?.trim();
    let deadlineTimer: ReturnType<typeof setTimeout> | undefined;
    const intelligence = await Promise.race([
      getMemberIntelligence(
        {
          personId: caller.person.id,
          connectionLimit:
            requested != null && Number.isFinite(requested)
              ? requested
              : undefined,
          connectionQuery: connectionQuery
            ? connectionQuery.slice(0, 80)
            : undefined,
        },
        { db: caller.db },
      ).finally(() => {
        if (deadlineTimer) clearTimeout(deadlineTimer);
      }),
      new Promise<never>((_, reject) => {
        deadlineTimer = setTimeout(() => {
          reject(
            Object.assign(new Error('intelligence deadline'), {
              name: 'TimeoutError',
            }),
          );
        }, INTELLIGENCE_DEADLINE_MS);
      }),
    ]);
    if (!intelligence) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json(intelligence, {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      (error.name === 'TimeoutError' ||
        error.message === 'intelligence deadline');
    if (timedOut) {
      console.warn('Member intelligence hit the home deadline');
      return NextResponse.json(
        { error: 'Home data is taking too long' },
        { status: 503 },
      );
    }
    console.error('Error loading member intelligence:', error);
    return NextResponse.json(
      { error: 'Failed to load member intelligence' },
      { status: 500 },
    );
  }
}
