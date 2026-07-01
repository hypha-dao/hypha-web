import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { schemaUpdateSpace } from '@hypha-platform/core/client';
import {
  authorizeSpacePanelInteraction,
  findSpaceById,
  updateSpaceConfigurationById,
} from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';
import { parseBearerToken } from '@web/utils/parse-bearer-token';

const schemaPatchSpaceConfiguration = schemaUpdateSpace.extend({
  id: z.number().int().positive(),
});

export async function PATCH(request: NextRequest) {
  const authToken = parseBearerToken(request.headers.get('Authorization'));
  if (!authToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = schemaPatchSpaceConfiguration.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { id, ...rest } = parsed.data;
  const space = await findSpaceById({ id }, { db });
  if (!space) {
    return NextResponse.json({ error: 'Space not found' }, { status: 404 });
  }

  const interactionAuth = await authorizeSpacePanelInteraction({
    spaceSlug: space.slug,
    authToken,
  });
  if (!interactionAuth.authorized) {
    return NextResponse.json(
      { error: interactionAuth.message },
      { status: 403 },
    );
  }

  try {
    const { originalSpace, updatedSpace } = await updateSpaceConfigurationById(
      { id, ...rest },
      { db },
    );

    revalidatePath(`/[lang]/dho/${originalSpace.slug}`, 'layout');
    if (originalSpace.slug !== updatedSpace.slug) {
      revalidatePath(`/[lang]/dho/${updatedSpace.slug}`, 'layout');
    }

    return NextResponse.json(updatedSpace);
  } catch (error) {
    console.error('Failed to update space configuration:', error);
    const message =
      error instanceof Error
        ? error.message
        : 'Failed to update space configuration';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
