import { NextRequest, NextResponse } from 'next/server';
import {
  approveIntegrationClient,
  schemaApproveIntegrationClient,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authorizeIntegrationClientOps } from '../../../_lib/authorize-integration-client-ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { slug: string };

/**
 * Approve a pending client and issue its key. The plaintext key is returned by
 * this call only. An optional body `{ scopes }` narrows or edits the requested
 * scopes before issuing.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const denied = authorizeIntegrationClientOps(request);
  if (denied) return denied;

  const { slug } = await params;

  // The body is optional; an empty one means "approve as requested".
  const raw = await request.text();
  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }
  const parsed = schemaApproveIntegrationClient.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const issued = await approveIntegrationClient(
      { slug, scopes: parsed.data.scopes },
      { db },
    );
    if (!issued) {
      return NextResponse.json(
        { error: 'No pending client with that slug' },
        { status: 404 },
      );
    }
    return NextResponse.json(
      {
        client: issued.client,
        clientKey: issued.plaintext,
        warning:
          'Store this key now — it is not recoverable. Never expose it in client-side code.',
      },
      { status: 200 },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to approve integration client:', { slug, message });
    return NextResponse.json(
      { error: 'Failed to approve integration client' },
      { status: 500 },
    );
  }
}
