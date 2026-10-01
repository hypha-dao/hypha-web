import {
  getMemberIntelligence,
  resolvePersonFromAuthToken,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const person = await resolvePersonFromAuthToken(authToken);
    if (!person) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const intelligence = await getMemberIntelligence(
      { personId: person.id },
      { db },
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
