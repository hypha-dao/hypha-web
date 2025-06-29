'use server';

// TODO: #602 Define RLS Policies for Agreement Table
// import { getDb } from '@core/common/server/get-db';
import {
  createAgreement,
  updateAgreementBySlug,
  deleteAgreementBySlug,
} from './mutations';
import {
  CreateAgreementInput,
  CreateChangeEntryMethodInput,
  UpdateAgreementBySlugInput,
  UpdateChangeEntryMethodBySlugInput,
} from '../types';
// TODO: #602 Define RLS Policies for Agreement Table
import { db } from '@hypha-platform/storage-postgres';

export async function createAgreementAction(
  data: CreateAgreementInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create agreement');
  return createAgreement({ ...data }, { db });
}

export async function updateAgreementBySlugAction(
  data: UpdateAgreementBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return updateAgreementBySlug(data, { db });
}

export async function deleteAgreementBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return deleteAgreementBySlug(data, { db });
}

export async function createChangeEntryMethodAction(
  data: CreateChangeEntryMethodInput,
  { authToken }: { authToken?: string },
) {
  if (!authToken) throw new Error('authToken is required to create agreement');
  return createAgreement({ ...data }, { db });
}

export async function updateChangeEntryMethodBySlugAction(
  data: UpdateChangeEntryMethodBySlugInput,
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return updateAgreementBySlug(data, { db });
}

export async function deleteChangeEntryMethodBySlugAction(
  data: { slug: string },
  { authToken }: { authToken?: string },
) {
  // TODO: #602 Define RLS Policies for Spaces Table
  // const db = getDb({ authToken });
  return deleteAgreementBySlug(data, { db });
}
