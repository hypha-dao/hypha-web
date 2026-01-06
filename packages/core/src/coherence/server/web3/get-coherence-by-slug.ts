'use server';

import { db } from '@hypha-platform/storage-postgres';
import { Coherence } from '../../types';
import { findCoherenceBySlug } from '../queries';

type GetCoherenceBySlugInput = {
  slug: string;
};

export async function getCoherenceBySlug(
  props: GetCoherenceBySlugInput,
): Promise<Coherence | undefined> {
  try {
    const coherence = await findCoherenceBySlug(props, { db });

    return {
      ...coherence,
    } as Coherence;
  } catch (error) {
    throw new Error('Failed to get coherence', {
      cause: error instanceof Error ? error : new Error(String(error)),
    });
  }
}
