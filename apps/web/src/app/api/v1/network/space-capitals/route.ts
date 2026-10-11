import { parseCapitalKeys } from '@hypha-platform/core/client';
import {
  findAllSpacesByMemberId,
  resolvePersonFromAuthToken,
  writeSpaceCapitals,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const bodySchema = z.object({
  spaceSlug: z.string().trim().min(1),
  seeks: z.array(z.string()).max(11),
  offers: z.array(z.string()).max(11),
});

export async function POST(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

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
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid capitals' }, { status: 400 });
  }

  const spaces = await findAllSpacesByMemberId(
    { memberId: person.id, parentOnly: false },
    { db },
  );
  const space = spaces.find((row) => row.slug === parsed.data.spaceSlug);
  if (!space) {
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }

  const saved = await writeSpaceCapitals(db, space.id, {
    seeks: parseCapitalKeys(parsed.data.seeks),
    offers: parseCapitalKeys(parsed.data.offers),
  });
  return NextResponse.json({ saved });
}
