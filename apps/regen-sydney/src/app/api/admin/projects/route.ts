import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@rs/server/auth';
import { createProject, listProjects } from '@rs/server/campaign/projects';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  title: z.string().min(3).max(200),
  program: z.string().max(120).optional(),
  group: z.enum(['initiative', 'program', 'enabling']).optional(),
  summary: z.string().max(4000).optional(),
  team: z.string().max(400).optional(),
  videoUrl: z.string().url().or(z.literal('')).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  payoutAddress: z.string().max(200).optional().nullable(),
  payoutNote: z.string().max(1000).optional().nullable(),
});

export async function GET(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    return NextResponse.json(await listProjects({ includeHidden: true }));
  });
}

export async function POST(request: Request) {
  return handle(async () => {
    await requireAdmin(request);
    const input = createSchema.parse(await readJson(request));
    const project = await createProject(input);
    return NextResponse.json(project, { status: 201 });
  });
}
