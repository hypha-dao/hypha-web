import { eq } from 'drizzle-orm';
import {
  spaceScheduledItems,
  type Space,
} from '@hypha-platform/storage-postgres';
import type { DbConfig } from '@hypha-platform/core/server';
import type {
  CreateScheduledItemInput,
  UpdateScheduledItemInput,
} from '../types';
import { applyMatrixAutoLink } from './matrix-link';

function stripPreset<
  T extends CreateScheduledItemInput | UpdateScheduledItemInput,
>(input: T) {
  const { recurrencePreset: _preset, ...rest } = input as T & {
    recurrencePreset?: unknown;
  };
  return rest;
}

export async function createScheduledItem(
  input: CreateScheduledItemInput,
  {
    db,
    space,
    lang,
  }: DbConfig & { space?: Pick<Space, 'slug' | 'chatRoomId'>; lang?: string },
) {
  const linked = space
    ? applyMatrixAutoLink(input, {
        spaceSlug: space.slug,
        chatRoomId: space.chatRoomId,
        lang,
      })
    : input;
  const values = stripPreset(linked);

  const [created] = await db
    .insert(spaceScheduledItems)
    .values({
      spaceId: values.spaceId,
      creatorId: values.creatorId,
      title: values.title,
      description: values.description ?? null,
      type: values.type,
      startsAt: values.startsAt,
      endsAt: values.endsAt,
      allDay: values.allDay ?? false,
      timezone: values.timezone ?? null,
      location: values.location ?? null,
      meetingUrl: values.meetingUrl ?? null,
      color: values.color ?? null,
      recurrenceRule: values.recurrenceRule ?? null,
      recurrenceUntil: values.recurrenceUntil ?? null,
      matrixRoomId: values.matrixRoomId ?? null,
      matrixAutoLink: values.matrixAutoLink ?? false,
      remindEmail: values.remindEmail ?? false,
      remindPush: values.remindPush ?? false,
      reminderMinutesBefore: values.reminderMinutesBefore ?? null,
    })
    .returning();

  if (!created) {
    throw new Error(
      `Failed to create scheduled item for spaceId=${input.spaceId}`,
    );
  }

  return created;
}

export async function updateScheduledItemById(
  { id, ...updates }: { id: number } & UpdateScheduledItemInput,
  {
    db,
    space,
    lang,
  }: DbConfig & { space?: Pick<Space, 'slug' | 'chatRoomId'>; lang?: string },
) {
  const linked: UpdateScheduledItemInput = space
    ? applyMatrixAutoLink(updates, {
        spaceSlug: space.slug,
        chatRoomId: space.chatRoomId,
        lang,
      })
    : updates;
  const values = stripPreset(linked);

  const [updated] = await db
    .update(spaceScheduledItems)
    .set({
      ...values,
      updatedAt: new Date(),
    })
    .where(eq(spaceScheduledItems.id, id))
    .returning();

  if (!updated) {
    throw new Error(`Scheduled item not found for id=${id}`);
  }

  return updated;
}

export async function deleteScheduledItemById(
  { id }: { id: number },
  { db }: DbConfig,
) {
  const deleted = await db
    .delete(spaceScheduledItems)
    .where(eq(spaceScheduledItems.id, id))
    .returning();

  if (!deleted || deleted.length === 0) {
    throw new Error(`Scheduled item not found for id=${id}`);
  }

  return deleted[0];
}
