import { createSpaceService } from '@hypha-platform/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const createSpaceSchema = z.object({
  title: z.string().min(1).max(50),
  description: z.string().min(1).max(300),
  logoUrl: z.string().url('Logo URL must be a valid URL').optional(),
  leadImage: z.string().url('Lead image must be a valid URL').optional(),
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(
      /^[a-z0-9-]+$/,
      'Slug must contain only lowercase letters, numbers, and hyphens',
    )
    .optional(),
  parentId: z.number().optional(),
});

export async function POST(request: Request) {
  try {
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    const validationResult = createSpaceSchema.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;
    const spaceService = createSpaceService({ authToken });

    const space = await spaceService.create(validatedData);

    return NextResponse.json(space);
  } catch (error) {
    console.error('Failed to create space:', error);
    return NextResponse.json(
      { error: 'Failed to create space' },
      { status: 500 },
    );
  }
}
