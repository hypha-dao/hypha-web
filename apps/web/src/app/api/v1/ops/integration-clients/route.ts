import { NextRequest, NextResponse } from 'next/server';
import {
  buildPaginatedResponse,
  listIntegrationClients,
  parseHttpPaginationParams,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

import { authorizeIntegrationClientOps } from '../_lib/authorize-integration-client-ops';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** List integration clients (metadata only, never key material). */
export async function GET(request: NextRequest) {
  const denied = authorizeIntegrationClientOps(request);
  if (denied) return denied;

  try {
    const { page, pageSize } = parseHttpPaginationParams(new URL(request.url), {
      defaultPageSize: 50,
    });
    const clients = await listIntegrationClients({ db });
    const offset = (page - 1) * pageSize;
    return NextResponse.json(
      buildPaginatedResponse(
        clients.slice(offset, offset + pageSize),
        clients.length,
        page,
        pageSize,
      ),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Failed to list integration clients:', { message });
    return NextResponse.json(
      { error: 'Failed to list integration clients' },
      { status: 500 },
    );
  }
}
