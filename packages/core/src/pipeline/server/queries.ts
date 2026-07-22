import { and, asc, desc, eq, inArray } from 'drizzle-orm';
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
import {
  DEAL_PRIORITIES,
  DEAL_STATUSES,
  PIPELINE_STATUSES,
  PIPELINE_SWIMLANES,
  type PipelineStatus,
  type PipelineSwimlane,
  type Region,
  type DealPriority,
  type DealStatus,
} from '../constants';
import { filterDeals } from '../filter-deals';

function toNumber(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

/**
 * Guard for values read from unconstrained text columns: keep known values,
 * warn (rather than silently mistype) and fall back for anything else.
 */
function asEnumValue<T extends string>(
  value: string,
  allowed: readonly T[],
  fallback: T,
  field: string,
): T {
  if ((allowed as readonly string[]).includes(value)) return value as T;
  console.warn(
    `[pipeline] Unknown ${field} value "${value}" in DB row; falling back to "${fallback}"`,
  );
  return fallback;
}

export function mapDealRow(row: typeof deals.$inferSelect): Deal {
  return {
    id: row.id,
    spaceId: row.spaceId,
    ownerId: row.ownerId,
    title: row.title,
    pipelineSwimlane: asEnumValue(
      row.pipelineSwimlane,
      PIPELINE_SWIMLANES,
      'Sales',
      'pipelineSwimlane',
    ),
    pipelineStatus: asEnumValue(
      row.pipelineStatus,
      PIPELINE_STATUSES,
      'Identified',
      'pipelineStatus',
    ),
    status: asEnumValue(row.status, DEAL_STATUSES, 'active', 'status'),
    priority: asEnumValue(row.priority, DEAL_PRIORITIES, 'medium', 'priority'),
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
  // Push simple equality filters into the WHERE clause (uses the composite
  // (spaceId, …) indexes); q/tag/hasDeadline/country stay in filterDeals.
  const conditions = [eq(deals.spaceId, spaceId)];
  const addListCondition = (
    column:
      | typeof deals.pipelineSwimlane
      | typeof deals.region
      | typeof deals.priority
      | typeof deals.status
      | typeof deals.pipelineStatus,
    value: string | string[] | undefined,
  ) => {
    if (value == null) return;
    const list = Array.isArray(value) ? value : [value];
    if (list.length > 0) conditions.push(inArray(column, list));
  };
  addListCondition(deals.pipelineSwimlane, filters?.swimlane);
  addListCondition(deals.region, filters?.region);
  addListCondition(deals.priority, filters?.priority);
  addListCondition(deals.status, filters?.status);
  addListCondition(deals.pipelineStatus, filters?.pipelineStatus);
  if (filters?.ownerId != null) {
    conditions.push(eq(deals.ownerId, filters.ownerId));
  }
  if (filters?.accountManagerId != null) {
    conditions.push(eq(deals.accountManagerId, filters.accountManagerId));
  }

  const rows = await db
    .select()
    .from(deals)
    .where(and(...conditions))
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
