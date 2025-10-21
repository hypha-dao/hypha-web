'use server';

// TODO: #602 Define RLS Policies for Agreement Table
// import { getDb } from '@hypha-platform/core/server';
import {
  createAgreement,
  updateAgreementBySlug,
  deleteAgreementBySlug,
  createToken,
  updateToken,
  deleteToken,
} from './mutations';
import {
  CreateAgreementInput,
  CreateChangeEntryMethodInput,
  UpdateAgreementBySlugInput,
  UpdateChangeEntryMethodBySlugInput,
  CreateTokenInput,
  UpdateTokenInput,
  DeleteTokenInput,
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

export async function createTokenAction(
  input: CreateTokenInput,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to create token');
  return createToken(input, { db });
}

export async function updateTokenAction(
  input: UpdateTokenInput,
  { authToken }: { authToken: string },
) {
  if (!authToken) {
    console.error('authToken is required to update token');
    throw new Error('authToken is required to update token');
  }

  try {
    const result = await updateToken(input, { db });
    return result;
  } catch (error) {
    console.error('updateTokenAction failed:', error);
    throw error;
  }
}

export async function deleteTokenAction(
  input: DeleteTokenInput,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to delete token');
  return deleteToken(input, { db });
}
