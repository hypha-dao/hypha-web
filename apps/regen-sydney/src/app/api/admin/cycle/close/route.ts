import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@rs/server/auth';
import { closeCycleAndOpenNext, toCycleDto } from '@rs/server/campaign/cycles';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  durationDays: z.number().int().min(1).max(365).optional(),
  name: z.string().min(1).max(120).optional(),
});

/**
 * Closes the open round and opens the next one. Closing freezes the allocation
 * worksheet, which is what the admin then pays out by hand.
 */
export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const body = bodySchema.parse(await readJson(request));
    const { closed, opened } = await closeCycleAndOpenNext(body);

    return NextResponse.json({
      closed: closed ? toCycleDto(closed) : null,
      opened: toCycleDto(opened),
    });
  });
}
