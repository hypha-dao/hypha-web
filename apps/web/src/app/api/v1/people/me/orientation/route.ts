import {
  resolvePersonFromAuthToken,
  updatePersonPrimaryOrientation,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const orientationBodySchema = z.object({
  primaryOrientation: z.enum(['member', 'builder', 'investor']),
});

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

    let json: unknown;
    try {
      json = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = orientationBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Choose member, builder, or investor' },
        { status: 400 },
      );
    }
    const { primaryOrientation } = parsed.data;

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
