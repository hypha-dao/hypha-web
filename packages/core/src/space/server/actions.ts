'use server';

// TODO: #602 Define RLS Policies for Spaces Table
// import { getDb } from '@hypha-platform/core/server';
import {
  createSpace,
  deleteSpaceBySlug,
  updateSpaceById,
  updateSpaceBySlug,
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
  revalidatePath(`/[lang]/dho/${slug}`, 'layout');
  return createSpace(data, { db });
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
  const result = await updateSpaceById(data, { db });

  const { slug } = result;
  revalidatePath(`/[lang]/dho/${slug}`, 'layout');

  return result;
}

export async function deleteSpaceBySlugAction(
  { slug }: DeleteSpaceBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return deleteSpaceBySlug({ slug }, { db });
}
