import { NextRequest, NextResponse } from 'next/server';
import {
  isUniqueViolation,
  requestIntegrationClient,
  schemaRequestIntegrationClient,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public: an integrator asks to become an approved client (#2515). Creates a
 * `pending` record with no key; Hypha approves it manually through the ops
 * endpoints, which is when a key is issued.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schemaRequestIntegrationClient.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const client = await requestIntegrationClient(parsed.data, { db });
    // Only what the requester needs back: no contact email echo, no key material.
    return NextResponse.json(
      { slug: client.slug, status: client.status },
      { status: 202 },
    );
  } catch (error) {
    if (isUniqueViolation(error, 'integration_clients_slug_unique')) {
      return NextResponse.json(
        { error: 'A client with this name already exists. Use another name.' },
        { status: 409 },
      );
    }
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to record integration client request:', { message });
    return NextResponse.json(
      { error: 'Failed to record the request' },
      { status: 500 },
    );
  }
}
