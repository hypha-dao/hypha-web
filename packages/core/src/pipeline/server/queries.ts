import { and, asc, desc, eq } from 'drizzle-orm';
import {
  deals,
  pipelineSavedViews,
  pipelineUserSettings,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import type {
  Deal,
  DealFilters,
  PipelineSavedViewRecord,
  PipelineUserSettingsRecord,
} from '../types';
import type {
  PipelineStatus,
  PipelineSwimlane,
  Region,
  DealPriority,
  DealStatus,
} from '../constants';
import { filterDeals } from '../filter-deals';

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function mapDealRow(row: typeof deals.$inferSelect): Deal {
  return {
    id: row.id,
    spaceId: row.spaceId,
    ownerId: row.ownerId,
    title: row.title,
    pipelineSwimlane: row.pipelineSwimlane as PipelineSwimlane,
    pipelineStatus: row.pipelineStatus as PipelineStatus,
    status: row.status as DealStatus,
    priority: row.priority as DealPriority,
    value: toNumber(row.value) ?? 0,
    currency: row.currency,
    country: row.country,
    region: (row.region as Region) || 'Global',
    contacts: row.contacts ?? [],
    contactPerson: row.contactPerson,
    contactEmail: row.contactEmail,
    linkedinUrl: row.linkedinUrl,
    contactUrl: row.contactUrl,
    teamMemberIds: row.teamMemberIds ?? [],
    accountManagerId: row.accountManagerId,
    successRate: row.successRate,
    nextAction: row.nextAction,
    nextActionDate: row.nextActionDate,
    notes: row.notes,
    tags: row.tags ?? [],
    blocked: row.blocked,
    blockerReason: row.blockerReason,
    submissionDeadline: row.submissionDeadline,
    fundingRateSme: toNumber(row.fundingRateSme),
    maxProjectSize: toNumber(row.maxProjectSize),
    expectedPartners: row.expectedPartners,
    isConsortiumLead: row.isConsortiumLead,
    eligibleCountries: row.eligibleCountries ?? [],
    callReference: row.callReference,
    programme: row.programme,
    eligibilityNotes: row.eligibilityNotes,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapSavedView(
  row: typeof pipelineSavedViews.$inferSelect,
): PipelineSavedViewRecord {
  return {
    id: row.id,
    spaceId: row.spaceId,
    personId: row.personId,
    name: row.name,
    filters: (row.filters ?? {}) as Record<string, unknown>,
    sort: (row.sort ?? {}) as Record<string, unknown>,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function mapUserSettings(
  row: typeof pipelineUserSettings.$inferSelect,
): PipelineUserSettingsRecord {
  return {
    id: row.id,
    spaceId: row.spaceId,
    personId: row.personId,
    countryFocus: row.countryFocus ?? [],
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export async function findDealsBySpaceId(
  {
    spaceId,
    filters,
  }: {
    spaceId: number;
    filters?: DealFilters;
  },
  { db }: DbConfig,
): Promise<Deal[]> {
  const rows = await db
    .select()
    .from(deals)
    .where(eq(deals.spaceId, spaceId))
    .orderBy(desc(deals.updatedAt));

  const mapped = rows.map(mapDealRow);
  return filters ? filterDeals(mapped, filters) : mapped;
}

export async function findDealById(
  { id, spaceId }: { id: number; spaceId?: number },
  { db }: DbConfig,
): Promise<Deal | null> {
  const conditions = [eq(deals.id, id)];
  if (spaceId != null) {
    conditions.push(eq(deals.spaceId, spaceId));
  }
  const [row] = await db
    .select()
    .from(deals)
    .where(and(...conditions))
    .limit(1);
  return row ? mapDealRow(row) : null;
}

export async function findPipelineSavedViews(
  { spaceId, personId }: { spaceId: number; personId: number },
  { db }: DbConfig,
): Promise<PipelineSavedViewRecord[]> {
  const rows = await db
    .select()
    .from(pipelineSavedViews)
    .where(
      and(
        eq(pipelineSavedViews.spaceId, spaceId),
        eq(pipelineSavedViews.personId, personId),
      ),
    )
    .orderBy(asc(pipelineSavedViews.name));
  return rows.map(mapSavedView);
}

export async function findPipelineSavedViewById(
  { id, spaceId, personId }: { id: number; spaceId: number; personId: number },
  { db }: DbConfig,
): Promise<PipelineSavedViewRecord | null> {
  const [row] = await db
    .select()
    .from(pipelineSavedViews)
    .where(
      and(
        eq(pipelineSavedViews.id, id),
        eq(pipelineSavedViews.spaceId, spaceId),
        eq(pipelineSavedViews.personId, personId),
      ),
    )
    .limit(1);
  return row ? mapSavedView(row) : null;
}

export async function findPipelineUserSettings(
  { spaceId, personId }: { spaceId: number; personId: number },
  { db }: DbConfig,
): Promise<PipelineUserSettingsRecord | null> {
  const [row] = await db
    .select()
    .from(pipelineUserSettings)
    .where(
      and(
        eq(pipelineUserSettings.spaceId, spaceId),
        eq(pipelineUserSettings.personId, personId),
      ),
    )
    .limit(1);
  return row ? mapUserSettings(row) : null;
}
