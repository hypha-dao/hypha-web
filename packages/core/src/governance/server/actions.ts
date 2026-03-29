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
  createTokenUpdate,
  applyTokenUpdate,
  deleteTokenUpdate,
} from './mutations';
import {
  CreateAgreementInput,
  CreateChangeEntryMethodInput,
  UpdateAgreementBySlugInput,
  UpdateChangeEntryMethodBySlugInput,
  CreateTokenInput,
  UpdateTokenInput,
  DeleteTokenInput,
  CreateTokenUpdateInput,
} from '../types';
// TODO: #602 Define RLS Policies for Agreement Table
import { db } from '@hypha-platform/storage-postgres';
import {
  findTokenUpdateByAddress,
  findTokenUpdateByDocumentId,
} from './queries';

export type DebugLogPayload = {
  hypothesisId: string;
  location: string;
  message: string;
  data?: Record<string, unknown>;
  timestamp?: number;
};

export async function appendDebugLogAction(payload: DebugLogPayload) {
  // #region agent log
  require('fs').appendFileSync(
    '/opt/cursor/logs/debug.log',
    JSON.stringify({
      hypothesisId: payload.hypothesisId,
      location: payload.location,
      message: payload.message,
      data: payload.data ?? {},
      timestamp: payload.timestamp ?? Date.now(),
    }) + '\n',
  );
  // #endregion
}

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

export async function createTokenUpdateAction(
  input: CreateTokenUpdateInput,
  { authToken }: { authToken: string },
) {
  if (!authToken)
    throw new Error('authToken is required to create token update');
  return createTokenUpdate(input, { db });
}

export async function applyTokenUpdateAction(
  documentId: number,
  { authToken }: { authToken: string },
) {
  if (!authToken)
    throw new Error('authToken is required to apply token update');
  return applyTokenUpdate(documentId, { db });
}

export async function deleteTokenUpdateAction(
  documentId: number,
  { authToken }: { authToken: string },
) {
  if (!authToken)
    throw new Error('authToken is required to delete token update');
  return deleteTokenUpdate(documentId, { db });
}

import { isAddress } from 'ethers';

export async function getTokenUpdateByAddressAction(
  address: string,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to get token update');
  if (!address || !isAddress(address)) {
    throw new Error('Invalid address format');
  }
  return findTokenUpdateByAddress(address, { db });
}

export async function getTokenUpdateByDocumentIdAction(
  documentId: number,
  { authToken }: { authToken: string },
) {
  if (!authToken) throw new Error('authToken is required to get token update');
  if (!Number.isFinite(documentId) || documentId < 1) {
    throw new Error('Invalid document id');
  }
  return findTokenUpdateByDocumentId(documentId, { db });
}
