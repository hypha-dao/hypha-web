import { and, eq } from 'drizzle-orm';
import {
  deals,
  pipelineSavedViews,
  pipelineUserSettings,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import type {
  CreateDealInput,
  CreatePipelineSavedViewInput,
  UpdateDealInput,
  UpdatePipelineSavedViewInput,
} from '../types';
import { mapDealRow } from './queries';
import { regionForCountry } from '../constants';

function numericOrNull(value: number | null | undefined): string | null {
  if (value == null) return null;
  return String(value);
}

export async function createDeal(input: CreateDealInput, { db }: DbConfig) {
  const region = input.region ?? regionForCountry(input.country) ?? 'Global';

  const [created] = await db
    .insert(deals)
    .values({
      spaceId: input.spaceId,
      ownerId: input.ownerId,
      title: input.title,
      pipelineSwimlane: input.pipelineSwimlane,
      pipelineStatus: input.pipelineStatus,
      status: input.status ?? 'active',
      priority: input.priority ?? 'medium',
      value: String(input.value ?? 0),
      currency: input.currency ?? '€',
      country: input.country ?? null,
      region,
      contacts: input.contacts ?? [],
      contactPerson: input.contactPerson ?? null,
      contactEmail: input.contactEmail ?? null,
      linkedinUrl: input.linkedinUrl ?? null,
      contactUrl: input.contactUrl ?? null,
      teamMemberIds: input.teamMemberIds ?? [],
      accountManagerId: input.accountManagerId ?? null,
      successRate: input.successRate ?? null,
      nextAction: input.nextAction ?? null,
      nextActionDate: input.nextActionDate ?? null,
      notes: input.notes ?? null,
      tags: input.tags ?? [],
      blocked: input.blocked ?? false,
      blockerReason: input.blockerReason ?? null,
      submissionDeadline: input.submissionDeadline ?? null,
      fundingRateSme: numericOrNull(input.fundingRateSme),
      maxProjectSize: numericOrNull(input.maxProjectSize),
      expectedPartners: input.expectedPartners ?? null,
      isConsortiumLead: input.isConsortiumLead ?? null,
      eligibleCountries: input.eligibleCountries ?? [],
      callReference: input.callReference ?? null,
      programme: input.programme ?? null,
      eligibilityNotes: input.eligibilityNotes ?? null,
    })
    .returning();

  if (!created) {
    throw new Error(`Failed to create deal for spaceId=${input.spaceId}`);
  }
  return mapDealRow(created);
}

export async function updateDealById(
  {
    id,
    spaceId,
    ...updates
  }: { id: number; spaceId: number } & UpdateDealInput,
  { db }: DbConfig,
) {
  const patch: Partial<typeof deals.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (updates.title !== undefined) patch.title = updates.title;
  if (updates.ownerId !== undefined) patch.ownerId = updates.ownerId;
  if (updates.pipelineSwimlane !== undefined) {
    patch.pipelineSwimlane = updates.pipelineSwimlane;
  }
  if (updates.pipelineStatus !== undefined) {
    patch.pipelineStatus = updates.pipelineStatus;
  }
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.priority !== undefined) patch.priority = updates.priority;
  if (updates.value !== undefined) patch.value = String(updates.value);
  if (updates.currency !== undefined) patch.currency = updates.currency;
  if (updates.country !== undefined) patch.country = updates.country;
  if (updates.region !== undefined) {
    patch.region = updates.region;
  } else if (updates.country !== undefined) {
    patch.region = regionForCountry(updates.country);
  }
  if (updates.contacts !== undefined) patch.contacts = updates.contacts;
  if (updates.contactPerson !== undefined) {
    patch.contactPerson = updates.contactPerson;
  }
  if (updates.contactEmail !== undefined) {
    patch.contactEmail = updates.contactEmail;
  }
  if (updates.linkedinUrl !== undefined)
    patch.linkedinUrl = updates.linkedinUrl;
  if (updates.contactUrl !== undefined) patch.contactUrl = updates.contactUrl;
  if (updates.teamMemberIds !== undefined) {
    patch.teamMemberIds = updates.teamMemberIds;
  }
  if (updates.accountManagerId !== undefined) {
    patch.accountManagerId = updates.accountManagerId;
  }
  if (updates.successRate !== undefined) {
    patch.successRate = updates.successRate;
  } else if (
    updates.pipelineStatus !== undefined ||
    updates.pipelineSwimlane !== undefined
  ) {
    // Moving to another stage re-seeds the deal from the stage default:
    // clear the per-deal override unless one is explicitly provided.
    patch.successRate = null;
  }
  if (updates.nextAction !== undefined) patch.nextAction = updates.nextAction;
  if (updates.nextActionDate !== undefined) {
    patch.nextActionDate = updates.nextActionDate;
  }
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.tags !== undefined) patch.tags = updates.tags;
  if (updates.blocked !== undefined) patch.blocked = updates.blocked;
  if (updates.blockerReason !== undefined) {
    patch.blockerReason = updates.blockerReason;
  }
  if (updates.submissionDeadline !== undefined) {
    patch.submissionDeadline = updates.submissionDeadline;
  }
  if (updates.fundingRateSme !== undefined) {
    patch.fundingRateSme = numericOrNull(updates.fundingRateSme);
  }
  if (updates.maxProjectSize !== undefined) {
    patch.maxProjectSize = numericOrNull(updates.maxProjectSize);
  }
  if (updates.expectedPartners !== undefined) {
    patch.expectedPartners = updates.expectedPartners;
  }
  if (updates.isConsortiumLead !== undefined) {
    patch.isConsortiumLead = updates.isConsortiumLead;
  }
  if (updates.eligibleCountries !== undefined) {
    patch.eligibleCountries = updates.eligibleCountries;
  }
  if (updates.callReference !== undefined) {
    patch.callReference = updates.callReference;
  }
  if (updates.programme !== undefined) patch.programme = updates.programme;
  if (updates.eligibilityNotes !== undefined) {
    patch.eligibilityNotes = updates.eligibilityNotes;
  }

  const [updated] = await db
    .update(deals)
    .set(patch)
    .where(and(eq(deals.id, id), eq(deals.spaceId, spaceId)))
    .returning();

  if (!updated) {
    throw new Error(`Deal not found for id=${id}`);
  }
  return mapDealRow(updated);
}

export async function deleteDealById(
  { id, spaceId }: { id: number; spaceId: number },
  { db }: DbConfig,
) {
  const [deleted] = await db
    .delete(deals)
    .where(and(eq(deals.id, id), eq(deals.spaceId, spaceId)))
    .returning();
  if (!deleted) {
    throw new Error(`Deal not found for id=${id}`);
  }
  return { id: deleted.id };
}

export async function createPipelineSavedView(
  input: CreatePipelineSavedViewInput,
  { db }: DbConfig,
) {
  const [created] = await db
    .insert(pipelineSavedViews)
    .values({
      spaceId: input.spaceId,
      personId: input.personId,
      name: input.name,
      filters: input.filters ?? {},
      sort: input.sort ?? {},
    })
    .returning();
  if (!created) {
    throw new Error('Failed to create saved view');
  }
  return created;
}

export async function updatePipelineSavedViewById(
  {
    id,
    spaceId,
    personId,
    ...updates
  }: {
    id: number;
    spaceId: number;
    personId: number;
  } & UpdatePipelineSavedViewInput,
  { db }: DbConfig,
) {
  const [updated] = await db
    .update(pipelineSavedViews)
    .set({
      ...updates,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(pipelineSavedViews.id, id),
        eq(pipelineSavedViews.spaceId, spaceId),
        eq(pipelineSavedViews.personId, personId),
      ),
    )
    .returning();
  if (!updated) {
    throw new Error(`Saved view not found for id=${id}`);
  }
  return updated;
}

export async function deletePipelineSavedViewById(
  { id, spaceId, personId }: { id: number; spaceId: number; personId: number },
  { db }: DbConfig,
) {
  const [deleted] = await db
    .delete(pipelineSavedViews)
    .where(
      and(
        eq(pipelineSavedViews.id, id),
        eq(pipelineSavedViews.spaceId, spaceId),
        eq(pipelineSavedViews.personId, personId),
      ),
    )
    .returning();
  if (!deleted) {
    throw new Error(`Saved view not found for id=${id}`);
  }
  return { id: deleted.id };
}

export async function upsertPipelineUserSettings(
  {
    spaceId,
    personId,
    countryFocus,
  }: { spaceId: number; personId: number; countryFocus: string[] },
  { db }: DbConfig,
) {
  const [existing] = await db
    .select()
    .from(pipelineUserSettings)
    .where(
      and(
        eq(pipelineUserSettings.spaceId, spaceId),
        eq(pipelineUserSettings.personId, personId),
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(pipelineUserSettings)
      .set({
        countryFocus,
        updatedAt: new Date(),
      })
      .where(eq(pipelineUserSettings.id, existing.id))
      .returning();
    return updated!;
  }

  const [created] = await db
    .insert(pipelineUserSettings)
    .values({ spaceId, personId, countryFocus })
    .returning();
  return created!;
}
