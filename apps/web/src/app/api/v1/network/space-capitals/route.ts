import { parseCapitalKeys } from '@hypha-platform/core/client';
import {
  findAllSpacesByMemberId,
  readSpaceCapitals,
  resolvePersonFromAuthToken,
  writeSpaceCapitals,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

async function memberSpace(request: NextRequest, spaceSlug: string) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return {
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }
  const person = await resolvePersonFromAuthToken(authToken);
  if (!person) {
    return {
      error: NextResponse.json({ error: 'User not found' }, { status: 404 }),
    };
  }
  const spaces = await findAllSpacesByMemberId(
    { memberId: person.id, parentOnly: false },
    { db },
  );
  const space = spaces.find((row) => row.slug === spaceSlug);
  if (!space) {
    return {
      error: NextResponse.json({ error: 'Space not found' }, { status: 404 }),
    };
  }
  return { space };
}

export async function GET(request: NextRequest) {
  const spaceSlug = request.nextUrl.searchParams.get('spaceSlug')?.trim() ?? '';
  if (!spaceSlug) {
    return NextResponse.json({ error: 'Missing space' }, { status: 400 });
  }
  const found = await memberSpace(request, spaceSlug);
  if ('error' in found && found.error) return found.error;
  if (!('space' in found) || !found.space) {
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }
  const stored = await readSpaceCapitals(db, [found.space.id]);
  return NextResponse.json(
    stored.get(found.space.id) ?? { seeks: [], offers: [] },
  );
}

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
