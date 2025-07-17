import { asc, eq, inArray, sql } from 'drizzle-orm';
import {
  memberships,
  Space,
  spaces,
  documents,
} from '@hypha-platform/storage-postgres';
import { DbConfig } from '@hypha-platform/core/server';

type FindAllSpacesProps = {
  search?: string;
};

export const findAllSpaces = async (
  { db }: DbConfig,
  props: FindAllSpacesProps = {},
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
      memberCount: sql<number>`count(distinct ${memberships.personId})`.mapWith(
        Number,
      ),
      documentCount: sql<number>`count(distinct ${documents.id})`.mapWith(
        Number,
      ),
      address: spaces.address,
    })
    .from(spaces)
    .leftJoin(memberships, eq(memberships.spaceId, spaces.id))
    .leftJoin(documents, eq(documents.spaceId, spaces.id))
    .where(
      props.search
        ? sql`(
            -- Full-text search for exact word matches (highest priority)
            (setweight(to_tsvector('english', ${spaces.title}), 'A') ||
             setweight(to_tsvector('english', ${spaces.description}), 'B')
            ) @@ plainto_tsquery('english', ${props.search})
            OR
            -- Partial word matching with ILIKE (case-insensitive)
            ${spaces.title} ILIKE ${'%' + props.search + '%'}
            OR
            ${spaces.description} ILIKE ${'%' + props.search + '%'}
          )`
        : undefined,
    )
    .groupBy(
      spaces.id,
      spaces.logoUrl,
      spaces.leadImage,
      spaces.title,
      spaces.description,
      spaces.slug,
      spaces.web3SpaceId,
      spaces.links,
      spaces.categories,
      spaces.parentId,
      spaces.createdAt,
      spaces.updatedAt,
      spaces.address,
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

type FindAllSpacesByWeb3SpaceIdsInput = {
  web3SpaceIds: number[];
};
export const findAllSpacesByWeb3SpaceIds = async (
  { web3SpaceIds }: FindAllSpacesByWeb3SpaceIdsInput,
  { db }: DbConfig,
) => {
  const results = await db
    .select()
    .from(spaces)
    .where(inArray(spaces.web3SpaceId, web3SpaceIds))
    .orderBy(asc(spaces.title));

  return results;
};
