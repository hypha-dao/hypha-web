import {
  asc,
  eq,
  inArray,
  sql,
  and,
  isNull,
  not,
  getTableColumns,
} from 'drizzle-orm';
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
          ? not(sql`${spaces.flags} @> '["sandbox"]'::jsonb`)
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

type FindAllOrganizationSpacesForNodeByIdInput = {
  id?: number | null;
};
export const findAllOrganizationSpacesForNodeById = async (
  { id }: FindAllOrganizationSpacesForNodeByIdInput,
  { db }: DbConfig,
) => {
  if (!id) return [];

  const columns = getTableColumns(spaces);
  const columnEntires = Object.entries(columns);
  const recordNames = columnEntires.map(([_, v]) => v.name);

  const columnsSql = sql.raw(recordNames.join(', '));
  const columnsWithAliasSql = sql.raw(
    recordNames.map((name) => `i.${name}`).join(', '),
  );
  const query = sql`
WITH RECURSIVE upward_tree AS (
  SELECT ${columnsSql}, 0 as level
  FROM ${spaces}
  WHERE ${spaces.id} = ${id}
  UNION ALL
  SELECT ${columnsWithAliasSql}, ut.level - 1
  FROM ${spaces} i
  INNER JOIN upward_tree ut
    ON i.id = ut.parent_id
  WHERE ut.parent_id IS NOT NULL
),
downward_tree AS (
  SELECT ${columnsSql}, 0 as level
  FROM upward_tree
  WHERE parent_id IS NULL
  UNION ALL
  SELECT ${columnsWithAliasSql}, dt.level + 1
  FROM ${spaces} i
  INNER JOIN downward_tree dt
    ON i.parent_id = dt.id
)
SELECT * FROM downward_tree
ORDER BY level, id;
`;
  const results = await db.execute(query);

  return results.rows.map((record) => {
    const space: Partial<Space> = {};
    for (const [name, column] of columnEntires) {
      space[name as keyof Space] = record[column.name] as any;
    }
    return space as Space;
  });
};
