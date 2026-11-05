'use server';

import slugify from 'slugify';
import {
  buildLocatedAtPatch,
  normalizeSpaceLocationFields,
} from '../../geo/location';
import { isUniqueViolation } from '../../common/server/unique-violation';
import { CreateSpaceInput, UpdateSpaceInput } from '../types';
import { and, eq, ne } from 'drizzle-orm';
import { DatabaseInstance } from '@hypha-platform/core/server';
import { spaces } from '@hypha-platform/storage-postgres';
import { parseCapitalKeys } from '../../network/capitals';
import { writeSpaceCapitals } from '../../network/exchange-capitals';
import {
  SPACES_WEB3_SPACE_ID_UNIQUE_INDEX,
  Web3SpaceIdConflictError,
} from './web3-space-id-conflict';

type Web3SpaceIdLookupExecutor = Pick<DatabaseInstance, 'select'>;

async function assertWeb3SpaceIdAvailable(
  db: Web3SpaceIdLookupExecutor,
  web3SpaceId: number | null | undefined,
  exclude?: { id?: number; slug?: string },
): Promise<void> {
  if (web3SpaceId == null) {
    return;
  }

  const conditions = [eq(spaces.web3SpaceId, web3SpaceId)];
  if (exclude?.id != null) {
    conditions.push(ne(spaces.id, exclude.id));
  }
  if (exclude?.slug != null) {
    conditions.push(ne(spaces.slug, exclude.slug));
  }

  const [existing] = await db
    .select({ id: spaces.id })
    .from(spaces)
    .where(conditions.length === 1 ? conditions[0] : and(...conditions))
    .limit(1);

  if (existing) {
    throw new Web3SpaceIdConflictError(web3SpaceId);
  }
}

function rethrowIfWeb3SpaceIdUniqueViolation(
  error: unknown,
  web3SpaceId: number | null | undefined,
): never {
  if (
    web3SpaceId != null &&
    isUniqueViolation(error, SPACES_WEB3_SPACE_ID_UNIQUE_INDEX)
  ) {
    throw new Web3SpaceIdConflictError(web3SpaceId);
  }
  throw error;
}

function takeExchangeCapitals<
  T extends { exchangeCapitals?: { seeks: string[]; offers: string[] } },
>(
  input: T,
): {
  capitals: {
    seeks: ReturnType<typeof parseCapitalKeys>;
    offers: ReturnType<typeof parseCapitalKeys>;
  } | null;
  rest: Omit<T, 'exchangeCapitals'>;
} {
  const { exchangeCapitals, ...rest } = input;
  if (!exchangeCapitals) return { capitals: null, rest };
  return {
    capitals: {
      seeks: parseCapitalKeys(exchangeCapitals.seeks),
      offers: parseCapitalKeys(exchangeCapitals.offers),
    },
    rest,
  };
}

export const createSpace = async (
  { title, slug: maybeSlug, ...rest }: CreateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const { capitals, rest: spaceFields } = takeExchangeCapitals(rest);
  const slug = maybeSlug || slugify(title, { lower: true });
  const normalizedLocation = normalizeSpaceLocationFields({
    latitude: rest.latitude,
    longitude: rest.longitude,
    locationLabel: rest.locationLabel,
    locationSource: rest.locationSource,
  });
  const locatedAtPatch = buildLocatedAtPatch({
    latitude: normalizedLocation.latitude,
    longitude: normalizedLocation.longitude,
  });

  await assertWeb3SpaceIdAvailable(db, spaceFields.web3SpaceId);

  let newSpace: typeof spaces.$inferSelect | undefined;
  try {
    [newSpace] = await db
      .insert(spaces)
      .values({
        title,
        slug,
        ...spaceFields,
        ...normalizedLocation,
        ...locatedAtPatch,
      })
      .returning();
  } catch (error) {
    rethrowIfWeb3SpaceIdUniqueViolation(error, spaceFields.web3SpaceId);
  }

  if (!newSpace) {
    throw new Error('Failed to create space');
  }

  if (capitals) {
    await writeSpaceCapitals(db, newSpace.id, capitals);
  }

  return newSpace;
};

function updateIncludesLocationFields(input: UpdateSpaceInput): boolean {
  return (
    input.latitude !== undefined ||
    input.longitude !== undefined ||
    input.locationLabel !== undefined ||
    input.locationSource !== undefined
  );
}

function withLocationTimestamp<T extends UpdateSpaceInput>(
  input: T,
): T & { locatedAt?: Date | null } {
  const normalizedLocation = normalizeSpaceLocationFields({
    latitude: input.latitude,
    longitude: input.longitude,
    locationLabel: input.locationLabel,
    locationSource: input.locationSource,
  });
  const locatedAtPatch = buildLocatedAtPatch({
    latitude: normalizedLocation.latitude,
    longitude: normalizedLocation.longitude,
  });
  return {
    ...input,
    ...normalizedLocation,
    ...locatedAtPatch,
  };
}

function applyLocationFieldsIfPresent<T extends UpdateSpaceInput>(
  input: T,
): T & { locatedAt?: Date | null } {
  if (!updateIncludesLocationFields(input)) {
    return input;
  }
  return withLocationTimestamp(input);
}

export const updateSpaceBySlug = async (
  { slug, ...rest }: { slug: string } & UpdateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const { capitals, rest: spaceFields } = takeExchangeCapitals(rest);
  await assertWeb3SpaceIdAvailable(db, spaceFields.web3SpaceId, { slug });

  let updatedSpace: typeof spaces.$inferSelect | undefined;
  try {
    [updatedSpace] = await db
      .update(spaces)
      .set(applyLocationFieldsIfPresent(spaceFields))
      .where(eq(spaces.slug, slug))
      .returning();
  } catch (error) {
    rethrowIfWeb3SpaceIdUniqueViolation(error, spaceFields.web3SpaceId);
  }

  if (!updatedSpace) {
    throw new Error('Failed to update space');
  }

  if (capitals) {
    await writeSpaceCapitals(db, updatedSpace.id, capitals);
  }

  return updatedSpace;
};

export const updateSpaceById = async (
  { id, ...rest }: { id: number } & UpdateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const { capitals, rest: spaceFields } = takeExchangeCapitals(rest);
  const result = await db.transaction(async (tx) => {
    const [originalSpace] = await tx
      .select()
      .from(spaces)
      .where(eq(spaces.id, id))
      .offset(0)
      .limit(1);

    if (!originalSpace) {
      throw new Error('Failed to update space: not found');
    }

    if (
      spaceFields.web3SpaceId != null &&
      spaceFields.web3SpaceId !== originalSpace.web3SpaceId
    ) {
      await assertWeb3SpaceIdAvailable(tx, spaceFields.web3SpaceId, { id });
    }

    let updatedSpace: typeof spaces.$inferSelect | undefined;
    try {
      [updatedSpace] = await tx
        .update(spaces)
        .set(applyLocationFieldsIfPresent(spaceFields))
        .where(eq(spaces.id, id))
        .returning();
    } catch (error) {
      rethrowIfWeb3SpaceIdUniqueViolation(error, spaceFields.web3SpaceId);
    }

    if (!updatedSpace) {
      throw new Error('Failed to update space');
    }

    return { originalSpace, updatedSpace };
  });
  if (capitals) {
    await writeSpaceCapitals(db, id, capitals);
  }
  return result;
};

function hasArchivedSpaceFlag(flags: unknown): boolean {
  return Array.isArray(flags) && flags.includes('archived');
}

/** Atomically archive/reparent children and update space configuration. */
export const updateSpaceConfigurationById = async (
  { id, ...rest }: { id: number } & UpdateSpaceInput,
  { db }: { db: DatabaseInstance },
) => {
  const { capitals, rest: spaceFields } = takeExchangeCapitals(rest);
  const result = await db.transaction(async (tx) => {
    const [originalSpace] = await tx
      .select()
      .from(spaces)
      .where(eq(spaces.id, id))
      .limit(1);

    if (!originalSpace) {
      throw new Error('Failed to update space: not found');
    }

    const nextFlags = spaceFields.flags ?? originalSpace.flags;
    const wasArchived = hasArchivedSpaceFlag(originalSpace.flags);
    const willBeArchived = hasArchivedSpaceFlag(nextFlags);
    const normalizedRest = willBeArchived
      ? { ...spaceFields, parentId: null }
      : spaceFields;

    if (
      normalizedRest.web3SpaceId != null &&
      normalizedRest.web3SpaceId !== originalSpace.web3SpaceId
    ) {
      await assertWeb3SpaceIdAvailable(tx, normalizedRest.web3SpaceId, { id });
    }

    if (!wasArchived && willBeArchived) {
      const reparentTo = originalSpace.parentId ?? null;
      await tx
        .update(spaces)
        .set({ parentId: reparentTo })
        .where(eq(spaces.parentId, id));
    }

    const nextParentId =
      normalizedRest.parentId !== undefined
        ? normalizedRest.parentId
        : originalSpace.parentId;

    if (nextParentId != null && nextParentId === id) {
      throw new Error('A space cannot be its own parent');
    }

    if (nextParentId != null) {
      let currentId: number | null = nextParentId;
      const visited = new Set<number>();
      while (currentId != null) {
        if (currentId === id) {
          throw new Error(
            'A space cannot be assigned to one of its descendants',
          );
        }
        if (visited.has(currentId)) {
          break;
        }
        visited.add(currentId);
        const [row] = await tx
          .select({ parentId: spaces.parentId })
          .from(spaces)
          .where(eq(spaces.id, currentId))
          .limit(1);
        currentId = row?.parentId ?? null;
      }
    }

    if (
      originalSpace.parentId == null &&
      nextParentId != null &&
      nextParentId !== originalSpace.parentId
    ) {
      await tx
        .update(spaces)
        .set({ parentId: null })
        .where(eq(spaces.id, nextParentId));
    }

    let updatedSpace: typeof spaces.$inferSelect | undefined;
    try {
      [updatedSpace] = await tx
        .update(spaces)
        .set(applyLocationFieldsIfPresent(normalizedRest))
        .where(eq(spaces.id, id))
        .returning();
    } catch (error) {
      rethrowIfWeb3SpaceIdUniqueViolation(error, normalizedRest.web3SpaceId);
    }

    if (!updatedSpace) {
      throw new Error('Failed to update space');
    }

    return { originalSpace, updatedSpace };
  });
  if (capitals) {
    await writeSpaceCapitals(db, id, capitals);
  }
  return result;
};

/**
 * Delete a space by slug
 *
 * @param slug - The slug of the space to delete
 * @param db - Database instance
 * @returns Boolean indicating if the deletion was successful
 */
export const deleteSpaceBySlug = async (
  { slug }: { slug: string },
  { db }: { db: DatabaseInstance },
): Promise<boolean> => {
  try {
    const result = await db
      .delete(spaces)
      .where(eq(spaces.slug, slug))
      .returning();

    return result.length > 0;
  } catch (error) {
    // Silent failure with return value
    return false;
  }
};
