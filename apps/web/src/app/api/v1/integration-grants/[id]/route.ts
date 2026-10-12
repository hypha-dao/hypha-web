import { NextRequest, NextResponse } from 'next/server';
import {
  authenticateIntegrationClient,
  INTEGRATION_CLIENT_KEY_HEADER,
  revokeIntegrationGrant,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authenticateHyphaUser } from '../../../../../lib/integration-clients/authenticate-hypha-user';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { id: string };

/**
 * Revoke a grant. The logged-in user (Bearer) revokes their own grant; a
 * client may also revoke its own grant by sending its key as well. Revoking
 * stops the client acting for the user; it does not remove the signer from the
 * wallet (D17).
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<Params> },
) {
  const { id } = await params;
  // Match the whole segment: `parseInt` would read "1junk" as 1.
  const grantId = /^[1-9]\d*$/.test(id) ? Number(id) : Number.NaN;
  if (!Number.isSafeInteger(grantId)) {
    return NextResponse.json({ error: 'Invalid grant id' }, { status: 400 });
  }

  const userAuth = await authenticateHyphaUser(request);
  if (!userAuth.ok) return userAuth.response;

  // A presented client key must be valid: never fall back to user-only revoke.
  let clientId: number | undefined;
  if (request.headers.get(INTEGRATION_CLIENT_KEY_HEADER)) {
    const clientAuth = await authenticateIntegrationClient({ request }, { db });
    if (!clientAuth.ok) {
      return NextResponse.json(
        { error: clientAuth.error, code: clientAuth.code },
        { status: clientAuth.status },
      );
    }
    clientId = clientAuth.client.id;
  }

  try {
    const revoked = await revokeIntegrationGrant(
      { grantId, personId: userAuth.person.id, clientId },
      { db },
    );
    if (!revoked) {
      return NextResponse.json(
        { error: 'No active grant with that id' },
        { status: 404 },
      );
    }
    return NextResponse.json({ revoked: true, id: grantId });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to revoke integration grant:', { grantId, message });
    return NextResponse.json(
      { error: 'Failed to revoke the grant' },
      { status: 500 },
    );
  }
}
