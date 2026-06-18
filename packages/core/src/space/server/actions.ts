'use server';

// TODO: #602 Define RLS Policies for Spaces Table
import { getDb } from '../../common/server/get-db';
import {
  createSpace,
  deleteSpaceBySlug,
  updateSpaceById,
  updateSpaceBySlug,
  updateSpaceConfigurationById,
} from './mutations';
import {
  CreateSpaceInput,
  DeleteSpaceBySlugInput,
  UpdateSpaceByIdInput,
  UpdateSpaceBySlugInput,
} from '../types';
// TODO: #602 Define RLS Policies for Spaces Table
import { db } from '@hypha-platform/storage-postgres';
import { revalidatePath } from 'next/cache';

export async function createSpaceAction(
  data: CreateSpaceInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  const { slug } = data;
  const createdSpace = await createSpace(data, { db });
  revalidatePath(`/[lang]/dho/${slug}`, 'layout');
  return createdSpace;
}

export async function updateSpaceBySlugAction(
  data: UpdateSpaceBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  const result = await updateSpaceBySlug(data, { db });

  const { slug } = data;
  revalidatePath(`/[lang]/dho/${slug}`, 'layout');

  return result;
}

export async function updateSpaceByIdAction(
  data: UpdateSpaceByIdInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  const { originalSpace, updatedSpace } = await updateSpaceById(data, { db });

  const { slug: originalSlug } = originalSpace;
  revalidatePath(`/[lang]/dho/${originalSlug}`, 'layout');
  const { slug: updatedSlug } = updatedSpace;
  if (originalSlug !== updatedSlug) {
    revalidatePath(`/[lang]/dho/${updatedSlug}`, 'layout');
  }

  return updatedSpace;
}

export async function updateSpaceConfigurationByIdAction(
  data: UpdateSpaceByIdInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) {
    throw new Error('authToken is required to update space configuration');
  }
  const authDb = getDb({ authToken });
  const { originalSpace, updatedSpace } = await updateSpaceConfigurationById(
    data,
    { db: authDb },
  );

  const { slug: originalSlug } = originalSpace;
  revalidatePath(`/[lang]/dho/${originalSlug}`, 'layout');
  const { slug: updatedSlug } = updatedSpace;
  if (originalSlug !== updatedSlug) {
    revalidatePath(`/[lang]/dho/${updatedSlug}`, 'layout');
  }

  return updatedSpace;
}

export async function deleteSpaceBySlugAction(
  { slug }: DeleteSpaceBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return deleteSpaceBySlug({ slug }, { db });
}
