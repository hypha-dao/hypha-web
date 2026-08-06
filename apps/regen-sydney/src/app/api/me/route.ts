import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { ViewerDto } from '@rs/lib/campaign-types';
import { requireViewer } from '@rs/server/auth';
import { campaignConfig } from '@rs/server/config';
import { getCurrentCycle } from '@rs/server/campaign/cycles';
import {
  getLatestGrant,
  getVotingPower,
  grantJoinBonus,
} from '@rs/server/campaign/grants';
import { getAllocations } from '@rs/server/campaign/voting';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Only a display name is accepted from the client. Email and wallet are read
 * from Privy server-side — admin access hangs off the email, so it cannot be
 * something the caller supplies.
 */
const bodySchema = z.object({
  name: z.string().max(200).optional().nullable(),
});

/**
 * Establishes the session: resolves the Privy token to a member, creates that
 * member on first sign-in, and grants the joining bonus exactly once.
 *
 * It is a POST because it has those side effects. The client calls it once per
 * sign-in and then reads `/api/campaign` for everything public.
 */
export async function POST(request: Request) {
  return handle(async () => {
    const body = bodySchema.parse(await readJson(request));
    const viewer = await requireViewer(request, { name: body.name });

    const { joinedNow } = await grantJoinBonus(viewer.member);

    const [cycle, votingPower, latestGrant] = await Promise.all([
      getCurrentCycle(),
      getVotingPower(viewer.member.id),
      getLatestGrant(viewer.member.id),
    ]);

    const allocations = cycle
      ? await getAllocations(cycle.id, viewer.member.id)
      : {};
    const allocated = Object.values(allocations).reduce(
      (sum, weight) => sum + weight,
      0,
    );

    const dto: ViewerDto = {
      memberId: viewer.member.id,
      email: viewer.member.email,
      name: viewer.member.name,
      walletAddress: viewer.member.walletAddress,
      isAdmin: viewer.isAdmin,
      votingPower,
      joinedNow,
      joinBonusRsut: campaignConfig.joinBonusRsut,
      allocations,
      allocated,
      remaining: Math.max(0, votingPower - allocated),
      mint: {
        status: latestGrant?.mintStatus ?? 'none',
        txHash: latestGrant?.mintTxHash ?? null,
      },
    };

    return NextResponse.json(dto);
  });
}
