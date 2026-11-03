import { NextRequest, NextResponse } from 'next/server';

import {
  getMessageInboxContext,
  resolveMemberCaller,
} from '@hypha-platform/core/server';

export const dynamic = 'force-dynamic';

/** Names for rooms the member already has. Does not create channels. */
export async function GET(request: NextRequest) {
  const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const caller = await resolveMemberCaller(authToken);
    if (!caller?.person.id) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const context = await getMessageInboxContext(
      {
        memberId: caller.person.id,
        walletAddress: caller.person.address,
      },
      { db: caller.db },
    );
    return NextResponse.json(context);
  } catch (error) {
    console.error('[message-inbox-context] lookup failed', error);
    return NextResponse.json(
      { error: 'Failed to load message context' },
      { status: 500 },
    );
  }
}
