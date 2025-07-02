'use server';

// TODO: #602 Define RLS Policies for Spaces Table
// import { getDb } from '@core/common/server/get-db';
import { createSpace, deleteSpaceBySlug, updateSpaceBySlug } from './mutations';
import {
  CreateSpaceInput,
  DeleteSpaceBySlugInput,
  UpdateSpaceBySlugInput,
} from '../types';
// TODO: #602 Define RLS Policies for Spaces Table
import { db } from '@hypha-platform/storage-postgres';

export async function createSpaceAction(
  data: CreateSpaceInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return createSpace(data, { db });
}

export async function updateSpaceBySlugAction(
  data: UpdateSpaceBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return updateSpaceBySlug(data, { db });
}

export async function deleteSpaceBySlugAction(
  { slug }: DeleteSpaceBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return deleteSpaceBySlug({ slug }, { db });
}
