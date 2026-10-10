import {
  resolvePersonFromAuthToken,
  updatePersonNetworkHorizon,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const horizonBodySchema = z.object({
  networkHorizon: z.enum(['spaces', 'network']),
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

    const parsed = horizonBodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Choose spaces or network' },
        { status: 400 },
      );
    }

    const updated = await updatePersonNetworkHorizon(
      { id: person.id, networkHorizon: parsed.data.networkHorizon },
      { db },
    );

    return NextResponse.json({
      networkHorizon: parsed.data.networkHorizon,
      personId: updated.id,
    });
  } catch (error) {
    console.error('Error updating network horizon:', error);
    return NextResponse.json(
      { error: 'Failed to update horizon' },
      { status: 500 },
    );
  }
}
