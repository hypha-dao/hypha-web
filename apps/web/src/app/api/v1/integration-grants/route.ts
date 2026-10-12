import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateIntegrationClient,
  listIntegrationGrantsForPerson,
  registerIntegrationGrant,
  resolveGrantScopes,
  schemaRegisterIntegrationGrant,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authenticateHyphaUser } from '../../../../lib/integration-clients/authenticate-hypha-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * An approved client records that the logged-in user trusts it for some
 * scopes (#2515). Needs the client key (`x-hypha-client-key`) and the user's
 * Privy token (Bearer). Does not check the wallet signer: that is verified when
 * the server signs, and its absence surfaces there as a distinct error (D17).
 */
export async function POST(request: NextRequest) {
  const clientAuth = await authenticateIntegrationClient({ request }, { db });
  if (!clientAuth.ok) {
    return NextResponse.json(
      { error: clientAuth.error, code: clientAuth.code },
      { status: clientAuth.status },
    );
  }

  const userAuth = await authenticateHyphaUser(request);
  if (!userAuth.ok) return userAuth.response;

  // The body is optional; an empty one grants all of the client's scopes.
  const raw = await request.text();
  let body: unknown = {};
  if (raw.trim()) {
    try {
      body = JSON.parse(raw);
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
  }
  const parsed = schemaRegisterIntegrationGrant.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const scopes = resolveGrantScopes(
    clientAuth.client.scopes,
    parsed.data.scopes,
  );
  if (!scopes) {
    return NextResponse.json(
      { error: 'Requested scopes exceed the scopes of this client' },
      { status: 403 },
    );
  }

  try {
    const grant = await registerIntegrationGrant(
      {
        clientId: clientAuth.client.id,
        personId: userAuth.person.id,
        scopes,
      },
      { db },
    );
    return NextResponse.json({ grant }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to register integration grant:', { message });
    return NextResponse.json(
      { error: 'Failed to register the grant' },
      { status: 500 },
    );
  }
}

/** The logged-in user's grants (active first), with the client identity. */
export async function GET(request: NextRequest) {
  const userAuth = await authenticateHyphaUser(request);
  if (!userAuth.ok) return userAuth.response;

  try {
    const grants = await listIntegrationGrantsForPerson(
      { personId: userAuth.person.id },
      { db },
    );
    return NextResponse.json({ grants });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to list integration grants:', { message });
    return NextResponse.json(
      { error: 'Failed to list grants' },
      { status: 500 },
    );
  }
}
