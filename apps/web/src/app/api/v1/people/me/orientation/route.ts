import {
  resolvePersonFromAuthToken,
  updatePersonPrimaryOrientation,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';

const ORIENTATIONS = ['member', 'builder', 'investor'] as const;

export async function POST(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const person = await resolvePersonFromAuthToken(authToken);
    if (!person) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const body = (await request.json()) as { primaryOrientation?: string };
    const primaryOrientation = ORIENTATIONS.find(
      (orientation) => orientation === body.primaryOrientation,
    );
    if (!primaryOrientation) {
      return NextResponse.json(
        { error: 'Choose member, builder, or investor' },
        { status: 400 },
      );
    }

    const updated = await updatePersonPrimaryOrientation(
      { id: person.id, primaryOrientation },
      { db },
    );

    return NextResponse.json({
      primaryOrientation: updated.primaryOrientation,
    });
  } catch (error) {
    console.error('Error updating orientation:', error);
    return NextResponse.json(
      { error: 'Failed to update orientation' },
      { status: 500 },
    );
  }
}
