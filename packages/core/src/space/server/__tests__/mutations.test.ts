import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  SPACES_WEB3_SPACE_ID_UNIQUE_INDEX,
  Web3SpaceIdConflictError,
  isWeb3SpaceIdConflictError,
} from '../web3-space-id-conflict';
import { schemaCreateSpaceWeb2, schemaUpdateSpace } from '../../validation';

type StoredSpaceRow = {
  id: number;
  title: string;
  description: string;
  slug: string;
  web3SpaceId: number | null;
  parentId: number | null;
  flags: string[];
  links: string[];
  categories: string[];
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  locationSource: string | null;
  locatedAt: Date | null;
};

/**
 * In-memory fake of the Drizzle query builder used by space mutations.
 * Inspects the SQL/column comparisons in `.where(...)` or uses explicit predicates
 * so `createSpace` and `updateSpace*` exercise the real mutation code paths.
 */
function createInMemorySpaceDb(initialRows: Partial<StoredSpaceRow>[] = []) {
  const rows: StoredSpaceRow[] = initialRows.map((row, idx) => ({
    id: row.id ?? idx + 1,
    title: row.title ?? `Space ${idx + 1}`,
    description: row.description ?? 'Description',
    slug: row.slug ?? `space-${idx + 1}`,
    web3SpaceId: row.web3SpaceId ?? null,
    parentId: row.parentId ?? null,
    flags: row.flags ?? [],
    links: row.links ?? [],
    categories: row.categories ?? [],
    latitude: row.latitude ?? null,
    longitude: row.longitude ?? null,
    locationLabel: row.locationLabel ?? null,
    locationSource: row.locationSource ?? null,
    locatedAt: row.locatedAt ?? null,
  }));
  let nextId = rows.reduce((max, row) => (row.id > max ? row.id : max), 0) + 1;

  function extractConditionTokens(node: unknown): Array<{
    op: string;
    column?: string;
    value?: unknown;
  }> {
    const out: Array<{ op: string; column?: string; value?: unknown }> = [];
    const chunks = (node as { queryChunks?: unknown[] } | null)?.queryChunks;
    if (!Array.isArray(chunks)) return out;

    let lastColumn: string | undefined;
    let lastOp: string | undefined;

    for (const chunk of chunks) {
      if (!chunk || typeof chunk !== 'object') continue;
      if ('queryChunks' in chunk) {
        out.push(...extractConditionTokens(chunk));
        continue;
      }
      if (
        'name' in chunk &&
        typeof (chunk as { name?: unknown }).name === 'string'
      ) {
        lastColumn = (chunk as { name: string }).name;
        continue;
      }
      if (
        'value' in chunk &&
        Array.isArray((chunk as { value?: unknown }).value)
      ) {
        const text = ((chunk as { value: unknown[] }).value ?? []).join('');
        if (text.includes('<>')) {
          lastOp = 'ne';
        } else if (text.includes('=')) {
          lastOp = 'eq';
        }
        continue;
      }
      if ('value' in chunk && lastColumn && lastOp) {
        out.push({
          op: lastOp,
          column: lastColumn,
          value: (chunk as { value: unknown }).value,
        });
        lastColumn = undefined;
        lastOp = undefined;
      }
    }
    return out;
  }

  function filterRowsByWhere(whereExpr: unknown): StoredSpaceRow[] {
    const tokens = extractConditionTokens(whereExpr);
    return rows.filter((row) =>
      tokens.every((token) => {
        const colValue =
          token.column === 'web3_space_id'
            ? row.web3SpaceId
            : token.column === 'id'
            ? row.id
            : token.column === 'slug'
            ? row.slug
            : token.column === 'parent_id'
            ? row.parentId
            : undefined;
        if (token.op === 'eq') return colValue === token.value;
        if (token.op === 'ne') return colValue !== token.value;
        return true;
      }),
    );
  }

  const db = {
    rows,
    select: () => {
      let matched = [...rows];
      const chain = {
        from: () => chain,
        where: (whereExpr: unknown) => {
          matched = filterRowsByWhere(whereExpr);
          return chain;
        },
        offset: () => chain,
        limit: (n: number) => {
          matched = matched.slice(0, n);
          return chain;
        },
        then: (
          resolve: (value: StoredSpaceRow[]) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise.resolve(matched).then(resolve, reject),
      };
      return chain;
    },
    insert: () => ({
      values: (values: Record<string, unknown>) => ({
        returning: async () => {
          const created: StoredSpaceRow = {
            id: nextId++,
            title: String(values.title ?? ''),
            description: String(values.description ?? 'SHOULD NOT BE EMPTY'),
            slug: String(values.slug ?? ''),
            web3SpaceId:
              values.web3SpaceId === undefined
                ? null
                : (values.web3SpaceId as number | null),
            parentId:
              values.parentId === undefined
                ? null
                : (values.parentId as number | null),
            flags: Array.isArray(values.flags)
              ? (values.flags as string[])
              : [],
            links: Array.isArray(values.links)
              ? (values.links as string[])
              : [],
            categories: Array.isArray(values.categories)
              ? (values.categories as string[])
              : [],
            latitude: (values.latitude as number | null | undefined) ?? null,
            longitude: (values.longitude as number | null | undefined) ?? null,
            locationLabel:
              (values.locationLabel as string | null | undefined) ?? null,
            locationSource:
              (values.locationSource as string | null | undefined) ?? null,
            locatedAt: (values.locatedAt as Date | null | undefined) ?? null,
          };
          rows.push(created);
          return [created];
        },
      }),
    }),
    update: () => ({
      set: (patch: Record<string, unknown>) => ({
        where: (whereExpr: unknown) => {
          const targets = filterRowsByWhere(whereExpr);
          for (const target of targets) {
            if (patch.title !== undefined) target.title = String(patch.title);
            if (patch.description !== undefined)
              target.description = String(patch.description);
            if (patch.slug !== undefined) target.slug = String(patch.slug);
            if (patch.web3SpaceId !== undefined) {
              target.web3SpaceId = patch.web3SpaceId as number | null;
            }
            if (patch.parentId !== undefined) {
              target.parentId = patch.parentId as number | null;
            }
            if (patch.flags !== undefined && Array.isArray(patch.flags)) {
              target.flags = patch.flags as string[];
            }
          }
          const resultPromise = Promise.resolve(targets);
          return Object.assign(resultPromise, {
            returning: async () => targets,
          });
        },
      }),
    }),
    transaction: async <T>(fn: (tx: typeof db) => Promise<T>): Promise<T> =>
      fn(db),
  };

  return db;
}

async function loadMutations() {
  const originalDefaultDbUrl = process.env.DEFAULT_DB_URL;
  if (!originalDefaultDbUrl) {
    process.env.DEFAULT_DB_URL = 'postgres://local:test@localhost:5432/test';
  }
  try {
    return await import('../mutations');
  } finally {
    if (originalDefaultDbUrl === undefined) {
      delete process.env.DEFAULT_DB_URL;
    } else {
      process.env.DEFAULT_DB_URL = originalDefaultDbUrl;
    }
  }
}

describe('space mutations web3SpaceId uniqueness', () => {
  it('creates a space when web3SpaceId is free', async () => {
    const { createSpace } = await loadMutations();
    const db = createInMemorySpaceDb([
      { id: 94, title: 'Hypha', slug: 'hypha', web3SpaceId: 240 },
    ]);

    const created = await createSpace(
      {
        title: 'Fresh On-Chain Space',
        description: 'New space with its own web3SpaceId',
        slug: 'fresh-onchain-space',
        web3SpaceId: 501,
      },
      { db: db as never },
    );

    expect(created.slug).toBe('fresh-onchain-space');
    expect(created.web3SpaceId).toBe(501);
    expect(db.rows).toHaveLength(2);
  });

  it('rejects creating a space with an already-used web3SpaceId', async () => {
    const { createSpace } = await loadMutations();
    const db = createInMemorySpaceDb([
      { id: 94, title: 'Hypha', slug: 'hypha', web3SpaceId: 240 },
    ]);

    await expect(
      createSpace(
        {
          title: 'Probe Space',
          description: 'Attempts to hijack web3SpaceId 240',
          slug: 'zz-w3-probe-attempt',
          web3SpaceId: 240,
        },
        { db: db as never },
      ),
    ).rejects.toSatisfy((error: unknown) => {
      expect(isWeb3SpaceIdConflictError(error)).toBe(true);
      expect(error).toBeInstanceOf(Web3SpaceIdConflictError);
      const conflict = error as Web3SpaceIdConflictError;
      expect(conflict.status).toBe(409);
      expect(conflict.web3SpaceId).toBe(240);
      expect(conflict.message).toContain('240');
      return true;
    });

    expect(db.rows).toHaveLength(1);
    expect(db.rows[0]?.slug).toBe('hypha');
  });

  it('allows creating multiple spaces with null or omitted web3SpaceId', async () => {
    const { createSpace } = await loadMutations();
    const db = createInMemorySpaceDb([
      { id: 94, title: 'Hypha', slug: 'hypha', web3SpaceId: 240 },
    ]);

    const first = await createSpace(
      {
        title: 'Web2 Draft One',
        description: 'Omitted web3SpaceId',
        slug: 'web2-draft-one',
      },
      { db: db as never },
    );

    const second = await createSpace(
      {
        title: 'Web2 Draft Two',
        description: 'Explicit null web3SpaceId',
        slug: 'web2-draft-two',
        web3SpaceId: null,
      },
      { db: db as never },
    );

    const third = await createSpace(
      {
        title: 'Web2 Draft Three',
        description: 'Another null web3SpaceId row',
        slug: 'web2-draft-three',
        web3SpaceId: null,
      },
      { db: db as never },
    );

    expect(first.web3SpaceId).toBeNull();
    expect(second.web3SpaceId).toBeNull();
    expect(third.web3SpaceId).toBeNull();
    expect(db.rows).toHaveLength(4);
  });

  it('maps a race-condition Postgres unique violation on spaces_web3_space_id_unique to Web3SpaceIdConflictError', async () => {
    const { createSpace } = await loadMutations();
    const baseDb = createInMemorySpaceDb();
    const raceDb = {
      ...baseDb,
      insert: () => ({
        values: () => ({
          returning: async () => {
            const pgError = Object.assign(
              new Error('duplicate key value violates unique constraint'),
              {
                code: '23505',
                constraint: SPACES_WEB3_SPACE_ID_UNIQUE_INDEX,
              },
            );
            throw pgError;
          },
        }),
      }),
    };

    await expect(
      createSpace(
        {
          title: 'Concurrent Space',
          description: 'Hits unique index under race',
          slug: 'concurrent-space',
          web3SpaceId: 777,
        },
        { db: raceDb as never },
      ),
    ).rejects.toBeInstanceOf(Web3SpaceIdConflictError);
  });

  it('maps a unique violation to the stored web3SpaceId when an update omits the field', async () => {
    const { updateSpaceById, updateSpaceBySlug, updateSpaceConfigurationById } =
      await loadMutations();
    const baseDb = createInMemorySpaceDb([
      {
        id: 853,
        title: 'Probe',
        slug: 'zz-w3-probe-1220',
        web3SpaceId: 240,
      },
    ]);
    const uniqueViolation = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      {
        code: '23505',
        constraint: SPACES_WEB3_SPACE_ID_UNIQUE_INDEX,
      },
    );
    const db = {
      ...baseDb,
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              throw uniqueViolation;
            },
          }),
        }),
      }),
      transaction: async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db),
    };

    await expect(
      updateSpaceBySlug(
        { slug: 'zz-w3-probe-1220', title: 'Renamed probe' },
        { db: db as never },
      ),
    ).rejects.toMatchObject({ web3SpaceId: 240, status: 409 });

    await expect(
      updateSpaceById({ id: 853, slug: 'renamed-probe' }, { db: db as never }),
    ).rejects.toMatchObject({ web3SpaceId: 240, status: 409 });

    await expect(
      updateSpaceConfigurationById(
        { id: 853, slug: 'renamed-probe' },
        { db: db as never },
      ),
    ).rejects.toMatchObject({ web3SpaceId: 240, status: 409 });
  });

  it('keeps an explicit null web3SpaceId as an unbind when a unique violation fires', async () => {
    const { updateSpaceById, updateSpaceBySlug } = await loadMutations();
    const baseDb = createInMemorySpaceDb([
      {
        id: 853,
        title: 'Probe',
        slug: 'zz-w3-probe-1220',
        web3SpaceId: 240,
      },
    ]);
    const uniqueViolation = Object.assign(
      new Error('duplicate key value violates unique constraint'),
      {
        code: '23505',
        constraint: SPACES_WEB3_SPACE_ID_UNIQUE_INDEX,
      },
    );
    const db = {
      ...baseDb,
      update: () => ({
        set: () => ({
          where: () => ({
            returning: async () => {
              throw uniqueViolation;
            },
          }),
        }),
      }),
      transaction: async <T>(fn: (tx: typeof db) => Promise<T>) => fn(db),
    };

    await expect(
      updateSpaceBySlug(
        { slug: 'zz-w3-probe-1220', web3SpaceId: null },
        { db: db as never },
      ),
    ).rejects.toBe(uniqueViolation);

    await expect(
      updateSpaceById({ id: 853, web3SpaceId: null }, { db: db as never }),
    ).rejects.toBe(uniqueViolation);
  });

  it('rejects updateSpaceBySlug, updateSpaceById, and updateSpaceConfigurationById when setting a taken web3SpaceId', async () => {
    const { updateSpaceById, updateSpaceBySlug, updateSpaceConfigurationById } =
      await loadMutations();
    const db = createInMemorySpaceDb([
      { id: 94, title: 'Hypha', slug: 'hypha', web3SpaceId: 240 },
      { id: 200, title: 'Other Space', slug: 'other-space', web3SpaceId: null },
    ]);

    await expect(
      updateSpaceBySlug(
        { slug: 'other-space', web3SpaceId: 240 },
        { db: db as never },
      ),
    ).rejects.toBeInstanceOf(Web3SpaceIdConflictError);

    await expect(
      updateSpaceById({ id: 200, web3SpaceId: 240 }, { db: db as never }),
    ).rejects.toBeInstanceOf(Web3SpaceIdConflictError);

    await expect(
      updateSpaceConfigurationById(
        { id: 200, web3SpaceId: 240 },
        { db: db as never },
      ),
    ).rejects.toBeInstanceOf(Web3SpaceIdConflictError);

    expect(db.rows.find((r) => r.id === 200)?.web3SpaceId).toBeNull();
  });

  it('allows updating a space when keeping its own web3SpaceId or assigning a free one', async () => {
    const { updateSpaceById, updateSpaceConfigurationById } =
      await loadMutations();
    const db = createInMemorySpaceDb([
      { id: 94, title: 'Hypha', slug: 'hypha', web3SpaceId: 240 },
      { id: 200, title: 'Other Space', slug: 'other-space', web3SpaceId: null },
    ]);

    const { updatedSpace: updatedHypha } = await updateSpaceConfigurationById(
      { id: 94, title: 'Hypha Updated', web3SpaceId: 240 },
      { db: db as never },
    );
    expect(updatedHypha.title).toBe('Hypha Updated');
    expect(updatedHypha.web3SpaceId).toBe(240);

    const { updatedSpace: boundOther } = await updateSpaceById(
      { id: 200, web3SpaceId: 999 },
      { db: db as never },
    );
    expect(boundOther.web3SpaceId).toBe(999);
  });

  it('accepts null and omitted web3SpaceId in schemaCreateSpaceWeb2 and schemaUpdateSpace', () => {
    const omitted = schemaCreateSpaceWeb2.safeParse({
      title: 'Space A',
      description: 'Valid description',
      parentId: null,
    });
    expect(omitted.success).toBe(true);

    const explicitNull = schemaCreateSpaceWeb2.safeParse({
      title: 'Space B',
      description: 'Valid description',
      parentId: null,
      web3SpaceId: null,
    });
    expect(explicitNull.success).toBe(true);

    const updateNull = schemaUpdateSpace.safeParse({
      web3SpaceId: null,
    });
    expect(updateNull.success).toBe(true);
  });
});
