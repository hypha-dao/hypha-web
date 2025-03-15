import { asc, eq } from 'drizzle-orm';
import { DatabaseInstance } from '@core/_container';
import { memberships, Space, spaces } from '@hypha-platform/storage-postgres';

type DbConfig = {
  db: DatabaseInstance;
};

export const findAllSpaces = async ({ db }: DbConfig) => {
  const results = await db.select().from(spaces).orderBy(asc(spaces.title));
  return results;
};
export const findSpaceById = async (
  { id }: { id: number },
  { db }: DbConfig,
) => {
  const results = await db.select().from(spaces).where(eq(spaces.id, id));
  return results[0] || null;
};

type FindSpaceBySlugInput = { slug: string };

export const findSpaceBySlug = async (
  { slug }: FindSpaceBySlugInput,
  { db }: DbConfig,
): Promise<Space | null> => {
  const results = await db.select().from(spaces).where(eq(spaces.slug, slug));
  return results[0] || null;
};

type FindAllSpacesByMemberIdInput = {
  memberId: number;
};
export const findAllSpacesByMemberId = async (
  { memberId }: FindAllSpacesByMemberIdInput,
  { db }: DbConfig,
) => {
  const results = await db
    .select()
    .from(spaces)
    .innerJoin(memberships, eq(memberships.spaceId, spaces.id))
    .where(eq(memberships.personId, memberId))
    .orderBy(asc(spaces.title));

  return results.map((row) => row.spaces);
};
