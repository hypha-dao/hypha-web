import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireViewer } from '@rs/server/auth';
import { getVotingPower } from '@rs/server/campaign/grants';
import {
  getOpenCycleOrThrow,
  getTally,
  setAllocations,
} from '@rs/server/campaign/voting';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  allocations: z
    .array(
      z.object({
        projectId: z.number().int().positive(),
        weight: z.number().min(0).max(1_000_000_000),
      }),
    )
    .max(200),
});

/**
 * Replaces the caller's ballot for the open round. The body is the complete
 * allocation, not a delta, so retries are naturally idempotent.
 */
export async function PUT(request: Request) {
  return handle(async () => {
    const viewer = await requireViewer(request);
    const body = bodySchema.parse(await readJson(request));
    const cycle = await getOpenCycleOrThrow();

    const allocations = await setAllocations({
      cycle,
      memberId: viewer.member.id,
      allocations: body.allocations,
    });

    const [tally, votingPower] = await Promise.all([
      getTally(cycle, viewer.member.id),
      getVotingPower(viewer.member.id),
    ]);

    const allocated = Object.values(allocations).reduce(
      (sum, weight) => sum + weight,
      0,
    );

    return NextResponse.json({
      allocations,
      allocated,
      remaining: Math.max(0, votingPower - allocated),
      tally: tally.rows,
      totals: tally.totals,
    });
  });
}
