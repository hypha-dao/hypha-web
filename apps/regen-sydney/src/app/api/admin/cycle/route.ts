import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@rs/server/auth';
import {
  getCurrentCycle,
  getCycleTotals,
  toCycleDto,
  updateCycleSettings,
} from '@rs/server/campaign/cycles';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  durationDays: z.number().int().min(1).max(365).optional(),
  matchMultiplier: z.number().min(0).max(100).optional(),
  name: z.string().min(1).max(120).optional(),
});

export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const cycle = await getCurrentCycle();
    if (!cycle) return NextResponse.json({ cycle: null, totals: null });

    const totals = await getCycleTotals(cycle.id);
    return NextResponse.json({
      cycle: toCycleDto(cycle),
      totals: {
        communityAud: totals.communityCents / 100,
        contributors: totals.contributors,
      },
    });
  });
}

export async function PATCH(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const patch = patchSchema.parse(await readJson(request));

    const cycle = await getCurrentCycle();
    if (!cycle) {
      return NextResponse.json(
        { error: 'No round exists yet' },
        { status: 404 },
      );
    }

    const updated = await updateCycleSettings(cycle.id, patch);
    return NextResponse.json({ cycle: toCycleDto(updated) });
  });
}
