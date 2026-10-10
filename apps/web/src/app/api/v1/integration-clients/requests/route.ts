import { NextRequest, NextResponse } from 'next/server';
import {
  findPersonBySub,
  isUniqueViolation,
  requestIntegrationClient,
  schemaRequestIntegrationClient,
  TooManyPendingRequestsError,
  verifyPrivyAuthToken,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { sendClientRequestEmail } from '../../../../../lib/integration-clients/send-client-request-email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function readBearerToken(request: NextRequest): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || null;
}

/**
 * An integrator asks to become an approved client (#2515). The requester must
 * be a logged-in Hypha user (Privy access token as Bearer): that identifies who
 * filed the request and bounds abuse. Creates a `pending` record with no key;
 * Hypha approves it manually through the ops endpoints, which is when a key is
 * issued.
 */
export async function POST(request: NextRequest) {
  const token = readBearerToken(request);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const auth = await verifyPrivyAuthToken(token);
  if (!auth.ok) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  try {
    const person = await findPersonBySub({ sub: auth.userId }, { db });
    if (!person) {
      return NextResponse.json(
        { error: 'A Hypha profile is required to request integration access' },
        { status: 403 },
      );
    }

    // The contact defaults to the requester's account email.
    const candidate = {
      contactEmail: person.email,
      ...(body as Record<string, unknown>),
    };
    const parsed = schemaRequestIntegrationClient.safeParse(candidate);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const client = await requestIntegrationClient(
      parsed.data,
      { requestedByPersonId: person.id },
      { db },
    );

    await sendClientRequestEmail({
      clientName: client.name,
      slug: client.slug,
      contactEmail: client.contactEmail,
      description: client.description,
      scopes: client.scopes,
      allowedOrigins: client.allowedOrigins,
      requesterName:
        [person.name, person.surname].filter(Boolean).join(' ') || 'Unknown',
      requesterSlug: person.slug ?? null,
    });

    // Only what the requester needs back: no key material.
    return NextResponse.json(
      { slug: client.slug, status: client.status },
      { status: 202 },
    );
  } catch (error) {
    if (error instanceof TooManyPendingRequestsError) {
      return NextResponse.json(
        {
          error:
            'You already have several pending requests. Wait for them to be reviewed.',
        },
        { status: 429 },
      );
    }
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
