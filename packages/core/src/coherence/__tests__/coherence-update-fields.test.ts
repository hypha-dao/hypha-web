import { describe, expect, it } from 'vitest';
import { PgDialect } from 'drizzle-orm/pg-core';
import { coherences } from '@hypha-platform/storage-postgres';
import { pickCoherenceUpdateFields } from '../coherence-update-fields';
import { updateCoherenceBySlug } from '../server/mutations';
import type { DatabaseInstance } from '../../server';

const dialect = new PgDialect();

function updateSql(values: object): string {
  return dialect.sqlToQuery(dialect.buildUpdateSet(coherences, values as never))
    .sql;
}

describe('pickCoherenceUpdateFields', () => {
  it('keeps only declared fields that the caller sent', () => {
    expect(
      pickCoherenceUpdateFields({
        archived: true,
        roomId: '!room:example.org',
        messages: 3,
        views: 8,
        spaceId: 42,
        creatorId: 7,
        title: 'forged title',
        slug: 'forged-slug',
        description: 'forged',
        impactCount: 99,
      }),
    ).toEqual({
      archived: true,
      roomId: '!room:example.org',
      messages: 3,
      views: 8,
    });
  });

  it('omits fields the caller did not send', () => {
    expect(pickCoherenceUpdateFields({ archived: false })).toEqual({
      archived: false,
    });
    expect(pickCoherenceUpdateFields({ impactCount: 4, spaceId: 1 })).toEqual(
      {},
    );
  });

  it('drops a forged spaceId that drizzle would otherwise write', () => {
    const forged = {
      archived: true,
      spaceId: 42,
      creatorId: 7,
      title: 'forged title',
      impactCount: 99,
    };
    const unsafe = updateSql(forged);
    const safe = updateSql(pickCoherenceUpdateFields(forged));

    expect(unsafe).toContain('"space_id"');
    expect(unsafe).toContain('"creator_id"');
    expect(unsafe).toContain('"title"');
    expect(safe).toContain('"archived"');
    expect(safe).not.toContain('space_id');
    expect(safe).not.toContain('creator_id');
    expect(safe).not.toContain('title');
    expect(safe).not.toContain('impact');
  });
});

describe('updateCoherenceBySlug', () => {
  function stubDb() {
    const sets: Record<string, unknown>[] = [];
    const db = {
      select: () => ({
        from: () => ({
          where: async () => [{ id: 11 }],
        }),
      }),
      update: () => ({
        set: (values: Record<string, unknown>) => {
          sets.push(values);
          return {
            where: () => ({
              returning: async () => [{ id: 11, ...values }],
            }),
          };
        },
      }),
    };
    return { db: db as unknown as DatabaseInstance, sets };
  }

  it('does not pass forged columns to the update', async () => {
    const { db, sets } = stubDb();
    await updateCoherenceBySlug(
      {
        slug: 'signal-a',
        archived: true,
        spaceId: 42,
        creatorId: 7,
        title: 'forged title',
        impactCount: 99,
      } as never,
      { db },
    );

    expect(sets).toEqual([{ archived: true }]);
  });

  it('refuses a payload that only forges protected fields', async () => {
    const { db, sets } = stubDb();
    await expect(
      updateCoherenceBySlug(
        {
          slug: 'signal-a',
          spaceId: 42,
          creatorId: 7,
          impactCount: 3,
        } as never,
        { db },
      ),
    ).rejects.toThrow('No coherence fields to update');
    expect(sets).toEqual([]);
  });
});
