import { describe, expect, it } from 'vitest';
import { coherences } from '@hypha-platform/storage-postgres';

import {
  rejectReplacementSpaceSlug,
  rejectSpaceSlugMatchingSignal,
} from '../assert-space-slug-signal';
import { updateSpaceBySlug, updateSpaceConfigurationById } from '../mutations';

type SpaceRow = {
  id: number;
  slug: string;
  parentId: number | null;
  flags: string[];
};

function mockDb(options: {
  space: SpaceRow;
  signals?: Array<{ slug: string | null }>;
}) {
  const updates: unknown[] = [];
  let signalReads = 0;

  const select = () => ({
    from: (table: unknown) => ({
      where: () => {
        const rows =
          table === coherences ? options.signals ?? [] : [options.space];
        if (table === coherences) signalReads += 1;
        const pending = Promise.resolve(rows);
        return Object.assign(pending, {
          limit: () => Promise.resolve(rows),
          offset: () => ({
            limit: () => Promise.resolve(rows),
          }),
        });
      },
    }),
  });

  const update = () => ({
    set: (values: unknown) => ({
      where: () => {
        updates.push(values);
        const pending = Promise.resolve([]);
        return Object.assign(pending, {
          returning: () =>
            Promise.resolve([
              {
                ...options.space,
                ...(typeof values === 'object' && values ? values : {}),
              },
            ]),
        });
      },
    }),
  });

  const executor = { select, update };
  return {
    db: {
      ...executor,
      transaction: (fn: (tx: typeof executor) => Promise<unknown>) =>
        fn(executor),
    },
    updates,
    signalReadCount: () => signalReads,
  };
}

const garden: SpaceRow = {
  id: 7,
  slug: 'garden',
  parentId: null,
  flags: [],
};

describe('rejectSpaceSlugMatchingSignal', () => {
  it('rejects a changed slug that matches a signal slug', async () => {
    const { db, signalReadCount } = mockDb({
      space: garden,
      signals: [{ slug: ' quest ' }, { slug: null }],
    });

    await expect(
      rejectSpaceSlugMatchingSignal(db as never, {
        spaceId: garden.id,
        currentSlug: 'garden',
        nextSlug: 'quest',
      }),
    ).rejects.toThrow(
      'Cannot set a space slug that matches one of its signal slugs "quest"',
    );
    expect(signalReadCount()).toBe(1);
  });

  it('does not read signals when the slug is omitted or unchanged', async () => {
    const { db, signalReadCount } = mockDb({
      space: garden,
      signals: [{ slug: 'garden' }],
    });

    await rejectSpaceSlugMatchingSignal(db as never, {
      spaceId: garden.id,
      currentSlug: 'garden',
    });
    await rejectSpaceSlugMatchingSignal(db as never, {
      spaceId: garden.id,
      currentSlug: 'garden',
      nextSlug: 'garden',
    });

    expect(signalReadCount()).toBe(0);
  });

  it('allows a slug that matches none of the signal slugs', async () => {
    const { db } = mockDb({
      space: garden,
      signals: [{ slug: 'quest' }, { slug: ' ' }],
    });

    await expect(
      rejectSpaceSlugMatchingSignal(db as never, {
        spaceId: garden.id,
        currentSlug: 'garden',
        nextSlug: 'new-garden',
      }),
    ).resolves.toBeUndefined();
  });
});

describe('updateSpaceConfigurationById', () => {
  it('rejects a slug change that collides with a signal before writing', async () => {
    const { db, updates, signalReadCount } = mockDb({
      space: garden,
      signals: [{ slug: 'quest' }],
    });

    await expect(
      updateSpaceConfigurationById(
        { id: garden.id, slug: ' quest ', title: 'Garden' },
        { db: db as never },
      ),
    ).rejects.toThrow(
      'Cannot set a space slug that matches one of its signal slugs "quest"',
    );
    expect(signalReadCount()).toBe(1);
    expect(updates).toEqual([]);
  });

  it('writes a slug that does not match a signal', async () => {
    const { db, updates } = mockDb({
      space: garden,
      signals: [{ slug: 'quest' }],
    });

    const result = await updateSpaceConfigurationById(
      { id: garden.id, slug: 'new-garden' },
      { db: db as never },
    );

    expect(result.updatedSpace.slug).toBe('new-garden');
    expect(updates).toEqual([expect.objectContaining({ slug: 'new-garden' })]);
  });

  it('does not read signals when the slug is unchanged or omitted', async () => {
    const unchanged = mockDb({
      space: garden,
      signals: [{ slug: 'garden' }],
    });
    await updateSpaceConfigurationById(
      { id: garden.id, slug: 'garden', title: 'Still garden' },
      { db: unchanged.db as never },
    );

    const omitted = mockDb({
      space: garden,
      signals: [{ slug: 'garden' }],
    });
    await updateSpaceConfigurationById(
      { id: garden.id, title: 'Renamed title' },
      { db: omitted.db as never },
    );

    expect(unchanged.signalReadCount()).toBe(0);
    expect(omitted.signalReadCount()).toBe(0);
    expect(unchanged.updates).toEqual([
      expect.objectContaining({ slug: 'garden', title: 'Still garden' }),
    ]);
  });
});

describe('updateSpaceBySlug', () => {
  it('rejects a replacement slug that matches a signal before writing', async () => {
    const { db, signalReadCount } = mockDb({
      space: garden,
      signals: [{ slug: 'quest' }],
    });

    await expect(
      rejectReplacementSpaceSlug(db as never, {
        lookupSlug: 'garden',
        patch: { title: 'Garden', slug: 'quest' },
      }),
    ).rejects.toThrow(
      'Cannot set a space slug that matches one of its signal slugs "quest"',
    );
    expect(signalReadCount()).toBe(1);
  });

  it('does not treat the lookup slug as a rename', async () => {
    const { db, updates, signalReadCount } = mockDb({
      space: garden,
      signals: [{ slug: 'garden' }],
    });

    const updated = await updateSpaceBySlug(
      { slug: 'garden', title: 'Garden' },
      { db: db as never },
    );

    expect(updated.title).toBe('Garden');
    expect(updates).toEqual([{ title: 'Garden' }]);
    expect(signalReadCount()).toBe(0);
  });
});
