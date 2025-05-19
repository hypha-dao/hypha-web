import { asc, eq } from 'drizzle-orm';
import { memberships, Space, spaces } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@core/common/server';
import { dnull } from '@core/utils/dnull';

export const findAllSpaces = async ({ db }: DbConfig) => {
  const results = await db.select().from(spaces).orderBy(asc(spaces.title));
  return dnull(results);
};

export const findSpaceById = async (
  { id }: { id: number },
  { db }: DbConfig,
) => {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, id));
  return space ? dnull(space) : null;
};

type FindSpaceBySlugInput = { slug: string };

export const findSpaceBySlug = async (
  { slug }: FindSpaceBySlugInput,
  { db }: DbConfig,
): Promise<(Space & { subspaces: Space[] }) | null> => {
  const response = await db.query.spaces.findFirst({
    where: (spaces, { eq }) => eq(spaces.slug, slug),
    with: {
      subspaces: true,
    },
  });

  const { subspaces, ...space } = response || {};
  const theSpace = dnull(space);
  const theSubspaces = subspaces?.map((s) => dnull(s));

  return response ? { ...theSpace, subspaces: theSubspaces } : null;
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
