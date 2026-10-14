import { NextResponse } from 'next/server';
import { z } from 'zod';

import type { PayoutRowDto } from '@rs/lib/campaign-types';
import { requireAdmin } from '@rs/server/auth';
import {
  getCurrentCycle,
  getPayoutWorksheet,
  setPayoutPaid,
  toCycleDto,
} from '@rs/server/campaign/cycles';
import { numeric } from '@rs/server/campaign/grants';
import { listProjects } from '@rs/server/campaign/projects';
import { getTally } from '@rs/server/campaign/voting';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The allocation worksheet.
 *
 * While a round is open this is a live projection that moves with every vote.
 * Once the round closes it is the frozen set of rows written at close time,
 * and only then can amounts be ticked off as paid.
 */
export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);

    const cycle = await getCurrentCycle();
    if (!cycle) {
      return NextResponse.json({ cycle: null, frozen: false, rows: [] });
    }

    if (cycle.status === 'closed') {
      const worksheet = await getPayoutWorksheet(cycle.id);
      const rows: PayoutRowDto[] = worksheet.map((row) => ({
        projectId: row.projectId,
        title: row.title,
        votes: numeric(row.votes),
        share: numeric(row.share),
        amountAud: row.amountCents / 100,
        paidAt: row.paidAt?.toISOString() ?? null,
        payoutAddress: row.payoutAddress,
      }));
      return NextResponse.json({
        cycle: toCycleDto(cycle),
        frozen: true,
        rows,
      });
    }

    const [tally, projects] = await Promise.all([
      getTally(cycle),
      listProjects({ includeHidden: true }),
    ]);
    const titles = new Map(projects.map((p) => [p.id, p.title]));

    const rows: PayoutRowDto[] = tally.rows.map((row) => ({
      projectId: row.projectId,
      title: titles.get(row.projectId) ?? `Project ${row.projectId}`,
      votes: row.votes,
      share: row.share,
      amountAud: row.projectedAud,
      paidAt: null,
      payoutAddress:
        projects.find((p) => p.id === row.projectId)?.payoutAddress ?? null,
    }));

    return NextResponse.json({
      cycle: toCycleDto(cycle),
      frozen: false,
      rows,
      totals: tally.totals,
    });
  });
}

const markSchema = z.object({
  projectId: z.number().int().positive(),
  paid: z.boolean(),
  reference: z.string().max(200).optional().nullable(),
});

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const body = markSchema.parse(await readJson(request));

    const cycle = await getCurrentCycle();
    if (!cycle) {
      return NextResponse.json(
        { error: 'No round exists yet' },
        { status: 404 },
      );
    }
    if (cycle.status !== 'closed') {
      return NextResponse.json(
        { error: 'Close the round before recording payouts' },
        { status: 409 },
      );
    }

    const updated = await setPayoutPaid(
      cycle.id,
      body.projectId,
      body.paid,
      body.reference,
    );
    return NextResponse.json({
      projectId: updated.projectId,
      paidAt: updated.paidAt?.toISOString() ?? null,
    });
  });
}
