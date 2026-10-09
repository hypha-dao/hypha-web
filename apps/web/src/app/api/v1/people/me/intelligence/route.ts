import {
  findSelf,
  getDb,
  getMemberIntelligence,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

function serviceDatabase() {
  try {
    // Touching the proxy initializes the pool. A missing URL throws here,
    // not while the route module is imported.
    if (typeof db.select !== 'function') return null;
    return db;
  } catch (error) {
    console.error(
      '[member-intelligence] service database is not configured',
      error instanceof Error ? error.message : 'unknown',
    );
    return null;
  }
}

export async function GET(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Same lookup as GET /me. A failure here is a 500, not "no profile".
    const person = await findSelf({ db: getDb({ authToken }) });
    if (!person?.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const database = serviceDatabase() ?? getDb({ authToken });
    const intelligence = await getMemberIntelligence(
      { personId: person.id },
      { db: database },
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
