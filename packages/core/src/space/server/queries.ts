import { asc, eq, inArray, sql, and, isNull, not } from 'drizzle-orm';
import { memberships, Space, spaces } from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';

type FindAllSpacesProps = {
  search?: string;
  parentOnly?: boolean;
  omitSandbox?: boolean;
};

export const findAllSpaces = async (
  { db }: DbConfig,
  { search, parentOnly = true, omitSandbox = false }: FindAllSpacesProps,
) => {
  const results = await db
    .select({
      id: spaces.id,
      logoUrl: spaces.logoUrl,
      leadImage: spaces.leadImage,
      title: spaces.title,
      description: spaces.description,
      slug: spaces.slug,
      web3SpaceId: spaces.web3SpaceId,
      links: spaces.links,
      categories: spaces.categories,
      parentId: spaces.parentId,
      createdAt: spaces.createdAt,
      updatedAt: spaces.updatedAt,
      address: spaces.address,
      flags: spaces.flags,
    })
    .from(spaces)
    .where(
      and(
        eq(spaces.isArchived, false),
        parentOnly ? isNull(spaces.parentId) : undefined,
        omitSandbox
          ? not(sql`${spaces.flags} @> '"sandbox"'::jsonb`)
          : undefined,
        search
          ? sql`(
              -- Full-text search for exact word matches (highest priority)
              (setweight(to_tsvector('english', ${spaces.title}), 'A') ||
               setweight(to_tsvector('english', ${spaces.description}), 'B')
              ) @@ plainto_tsquery('english', ${search})
              OR
              -- Partial word matching with ILIKE (case-insensitive)
              ${spaces.title} ILIKE ${'%' + search + '%'}
              OR
              ${spaces.description} ILIKE ${'%' + search + '%'}
            )`
          : undefined,
      ),
    )
    .orderBy(asc(spaces.title));

  return results;
};

export const findSpaceById = async (
  { id }: { id: number },
  { db }: DbConfig,
) => {
  const [space] = await db.select().from(spaces).where(eq(spaces.id, id));
  return space ? space : null;
};

export const findSpaceByAddress = async (
  { address }: { address: string },
  { db }: DbConfig,
) => {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(sql`upper(${spaces.address})`, address.toUpperCase()));
  return space ? space : null;
};

export const findSpaceByWeb3Id = async (
  { id }: { id: number },
  { db }: DbConfig,
) => {
  const [space] = await db
    .select()
    .from(spaces)
    .where(eq(spaces.web3SpaceId, id));
  return space ? space : null;
};

export const findParentSpaceById = async (
  { id }: { id?: number | null },
  { db }: DbConfig,
) => {
  if (!id) return null;
  return await findSpaceById({ id }, { db });
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
      members: true,
      documents: true,
    },
  });

  if (!response) return null;

  return {
    ...response,
    subspaces: response.subspaces ?? [],
  };
};

type FindAllSpacesByMemberIdInput = {
  memberId: number;
  parentOnly?: boolean;
};
export const findAllSpacesByMemberId = async (
  { memberId, parentOnly = true }: FindAllSpacesByMemberIdInput,
  { db }: DbConfig,
) => {
  const results = await db
    .select()
    .from(spaces)
    .innerJoin(memberships, eq(memberships.spaceId, spaces.id))
    .where(
      and(
        eq(memberships.personId, memberId),
        eq(spaces.isArchived, false),
        parentOnly ? isNull(spaces.parentId) : undefined,
      ),
    )
    .orderBy(asc(spaces.title));

  return results.map((row) => row.spaces);
};

type FindAllSpacesByWeb3SpaceIdsInput = {
  web3SpaceIds: number[];
  parentOnly?: boolean;
};
export const findAllSpacesByWeb3SpaceIds = async (
  { web3SpaceIds, parentOnly = true }: FindAllSpacesByWeb3SpaceIdsInput,
  { db }: DbConfig,
) => {
  const results = await db
    .select()
    .from(spaces)
    .where(
      and(
        inArray(spaces.web3SpaceId, web3SpaceIds),
        eq(spaces.isArchived, false),
        parentOnly ? isNull(spaces.parentId) : undefined,
      ),
    )
    .orderBy(asc(spaces.title));

  return results;
};
