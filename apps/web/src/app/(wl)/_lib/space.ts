import { cache } from 'react';
import { notFound } from 'next/navigation';
import { findSpaceBySlug } from '@hypha-platform/core/server';
import { db } from '@hypha-platform/storage-postgres';

/** The Space for a white-label page, or the white-label 404. */
export const getWhiteLabelSpace = cache(async (slug: string) => {
  const space = await findSpaceBySlug({ slug }, { db });
  if (!space) notFound();
  return space;
});

export type WhiteLabelPageProps = {
  params: Promise<{ id: string; lang: string }>;
};
