import { NextRequest, NextResponse } from 'next/server';
import { getPlatformDashboard } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { readOpsSecret } from '../../_lib/ops-auth';

export async function GET(request: NextRequest) {
  const configuredSecret =
    process.env.HYPHA_SPACE_MEMORY_OPS_SECRET?.trim() ?? '';
  if (!configuredSecret) {
    return NextResponse.json(
      { error: 'HYPHA_SPACE_MEMORY_OPS_SECRET is not configured' },
      { status: 503 },
    );
  }
  if (readOpsSecret(request) !== configuredSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const dashboard = await getPlatformDashboard({ db });
    return NextResponse.json(dashboard);
  } catch (error) {
    console.error('[platform-dashboard] Failed to load dashboard', error);
    return NextResponse.json(
      { error: 'Failed to load platform dashboard' },
      { status: 500 },
    );
  }
}
