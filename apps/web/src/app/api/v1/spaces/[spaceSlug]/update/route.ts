import { createSpaceService } from '@hypha-platform/core';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const schemaUpdateSpace = z.object({
  title: z.string().min(1).max(50).optional(),
  description: z.string().min(1).max(300).optional(),
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
  web3SpaceId: z.number(),
  parentId: z.number().optional(),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ spaceSlug: string }> },
) {
  try {
    const { spaceSlug } = await params;
    const authToken = request.headers.get('Authorization')?.split(' ')[1] || '';
    if (!authToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse the request body
    const body = await request.json();

    // Validate with Zod schema
    const validationResult = schemaUpdateSpace.safeParse(body);

    if (!validationResult.success) {
      const errors = validationResult.error.format();
      return NextResponse.json(
        { error: 'Validation failed', details: errors },
        { status: 400 },
      );
    }

    const validatedData = validationResult.data;
    const spaceService = createSpaceService({ authToken });

    const space = await spaceService.updateBySlug({
      ...validatedData,
      slug: spaceSlug,
    });

    return NextResponse.json(space);
  } catch (error) {
    console.error('Failed to update space:', error);
    return NextResponse.json(
      { error: 'Failed to update space' },
      { status: 500 },
    );
  }
}
