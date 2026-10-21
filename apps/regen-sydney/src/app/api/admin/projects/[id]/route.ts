import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAdmin } from '@rs/server/auth';
import { deleteProject, updateProject } from '@rs/server/campaign/projects';
import { handle, readJson } from '@rs/server/http';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const patchSchema = z.object({
  title: z.string().min(3).max(200).optional(),
  program: z.string().max(120).optional(),
  group: z.enum(['initiative', 'program', 'enabling']).optional(),
  summary: z.string().max(4000).optional(),
  team: z.string().max(400).optional(),
  videoUrl: z.string().url().or(z.literal('')).optional().nullable(),
  imageUrl: z.string().max(500).optional().nullable(),
  payoutAddress: z.string().max(200).optional().nullable(),
  payoutNote: z.string().max(1000).optional().nullable(),
  active: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

type Params = { params: Promise<{ id: string }> };

function parseId(raw: string): number {
  const id = Number(raw);
  if (!Number.isInteger(id) || id <= 0) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['id'],
        message: 'Invalid project id',
      },
    ]);
  }
  return id;
}

export async function PATCH(request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin(request);
    const id = parseId((await params).id);
    const patch = patchSchema.parse(await readJson(request));
    return NextResponse.json(await updateProject(id, patch));
  });
}

export async function DELETE(request: Request, { params }: Params) {
  return handle(async () => {
    await requireAdmin(request);
    const id = parseId((await params).id);
    await deleteProject(id);
    return NextResponse.json({ deleted: true });
  });
}
