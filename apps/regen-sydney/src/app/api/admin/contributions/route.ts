import { NextResponse } from 'next/server';

import { requireAdmin } from '@rs/server/auth';
import { listContributions } from '@rs/server/campaign/contributions';
import { handle } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return NextResponse.json(await listContributions());
  });
}
