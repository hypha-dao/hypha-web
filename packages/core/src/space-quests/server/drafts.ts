import { and, desc, eq } from 'drizzle-orm';
import { spaceQuestDrafts } from '@hypha-platform/storage-postgres';
import type { DbConfig } from '../../common/server/types';
import { findSpaceBySlug } from '../../space/server/queries';
import {
  schemaQuestCreateDraftPayload,
  type schemaSaveQuestDraft,
} from '../validation';
import type { z } from 'zod';

export type QuestDraftListItem = {
  id: number;
  name: string;
  updatedAt: string;
};

export type QuestDraftRecord = QuestDraftListItem & {
  payload: z.infer<typeof schemaQuestCreateDraftPayload>;
};

function listItem(row: {
  id: number;
  name: string;
  updatedAt: Date;
}): QuestDraftListItem {
  return {
    id: row.id,
    name: row.name,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listSpaceQuestDrafts(
  { spaceSlug, authorPersonId }: { spaceSlug: string; authorPersonId: number },
  { db }: DbConfig,
): Promise<QuestDraftListItem[] | null> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;
  const rows = await db
    .select({
      id: spaceQuestDrafts.id,
      name: spaceQuestDrafts.name,
      updatedAt: spaceQuestDrafts.updatedAt,
    })
    .from(spaceQuestDrafts)
    .where(
      and(
        eq(spaceQuestDrafts.spaceId, space.id),
        eq(spaceQuestDrafts.authorPersonId, authorPersonId),
      ),
    )
    .orderBy(desc(spaceQuestDrafts.updatedAt));
  return rows.map(listItem);
}

export async function getSpaceQuestDraft(
  {
    spaceSlug,
    draftId,
    authorPersonId,
  }: { spaceSlug: string; draftId: number; authorPersonId: number },
  { db }: DbConfig,
): Promise<QuestDraftRecord | null> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;
  const [row] = await db
    .select()
    .from(spaceQuestDrafts)
    .where(
      and(
        eq(spaceQuestDrafts.id, draftId),
        eq(spaceQuestDrafts.spaceId, space.id),
        eq(spaceQuestDrafts.authorPersonId, authorPersonId),
      ),
    )
    .limit(1);
  if (!row) return null;
  const payload = schemaQuestCreateDraftPayload.safeParse(row.payload);
  if (!payload.success) return null;
  return {
    ...listItem(row),
    payload: payload.data,
  };
}

export async function saveSpaceQuestDraft(
  {
    spaceSlug,
    authorPersonId,
    id,
    payload,
  }: {
    spaceSlug: string;
    authorPersonId: number;
    id?: number;
    payload: z.infer<typeof schemaSaveQuestDraft>['payload'];
  },
  { db }: DbConfig,
): Promise<QuestDraftRecord | null> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;
  const name = payload.draft.name.trim().slice(0, 160);
  const now = new Date();
  if (id) {
    const [updated] = await db
      .update(spaceQuestDrafts)
      .set({
        name,
        payload: payload as Record<string, unknown>,
        updatedAt: now,
      })
      .where(
        and(
          eq(spaceQuestDrafts.id, id),
          eq(spaceQuestDrafts.spaceId, space.id),
          eq(spaceQuestDrafts.authorPersonId, authorPersonId),
        ),
      )
      .returning();
    if (!updated) return null;
    return { ...listItem(updated), payload };
  }
  const [created] = await db
    .insert(spaceQuestDrafts)
    .values({
      spaceId: space.id,
      authorPersonId,
      name,
      payload: payload as Record<string, unknown>,
      updatedAt: now,
    })
    .returning();
  if (!created) return null;
  return { ...listItem(created), payload };
}

export async function deleteSpaceQuestDraft(
  {
    spaceSlug,
    draftId,
    authorPersonId,
  }: { spaceSlug: string; draftId: number; authorPersonId: number },
  { db }: DbConfig,
): Promise<boolean | null> {
  const space = await findSpaceBySlug({ slug: spaceSlug }, { db });
  if (!space) return null;
  const deleted = await db
    .delete(spaceQuestDrafts)
    .where(
      and(
        eq(spaceQuestDrafts.id, draftId),
        eq(spaceQuestDrafts.spaceId, space.id),
        eq(spaceQuestDrafts.authorPersonId, authorPersonId),
      ),
    )
    .returning();
  return deleted.length > 0;
}
