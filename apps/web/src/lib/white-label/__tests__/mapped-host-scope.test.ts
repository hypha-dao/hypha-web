import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findSpace } = vi.hoisted(() => ({ findSpace: vi.fn() }));
vi.mock('@hypha-platform/storage-postgres', () => ({
  db: { query: { spaces: { findFirst: findSpace } } },
}));

import {
  resetMappedHostScopeCache,
  resolveMappedHostScope,
  type MappedHostScopeDeps,
} from '../mapped-host-scope';
import { WL_SPACE_HEADER } from '../constants';

const req = (slug?: string) => ({
  headers: new Headers(slug ? { [WL_SPACE_HEADER]: slug } : {}),
});

describe('resolveMappedHostScope', () => {
  let clock = 0;
  const findSpaceIds = vi.fn();
  const deps: MappedHostScopeDeps = { findSpaceIds, now: () => clock };

  beforeEach(() => {
    resetMappedHostScopeCache();
    clock = 1_000;
    findSpaceIds.mockReset();
    findSpace.mockReset();
  });

  it('no header: main app, no lookup', async () => {
    expect(await resolveMappedHostScope(req(), deps)).toEqual({ kind: 'main' });
    expect(findSpaceIds).not.toHaveBeenCalled();
  });

  it('header present: resolves the slug to both ids', async () => {
    findSpaceIds.mockResolvedValue({ spaceId: 7, web3SpaceId: 42 });
    expect(await resolveMappedHostScope(req('space-one'), deps)).toEqual({
      kind: 'mapped',
      slug: 'space-one',
      spaceId: 7,
      web3SpaceId: 42,
    });
    expect(findSpaceIds).toHaveBeenCalledWith('space-one');
  });

  it('unknown slug: fails closed and is not cached', async () => {
    findSpaceIds.mockResolvedValue(null);
    expect(await resolveMappedHostScope(req('nope'), deps)).toEqual({
      kind: 'unknown-space',
    });
    findSpaceIds.mockResolvedValue({ spaceId: 1, web3SpaceId: null });
    expect((await resolveMappedHostScope(req('nope'), deps)).kind).toBe(
      'mapped',
    );
    expect(findSpaceIds).toHaveBeenCalledTimes(2);
  });

  it('caches a found Space briefly, then looks it up again', async () => {
    findSpaceIds.mockResolvedValue({ spaceId: 7, web3SpaceId: 42 });
    await resolveMappedHostScope(req('space-one'), deps);
    clock += 29_000;
    await resolveMappedHostScope(req('space-one'), deps);
    expect(findSpaceIds).toHaveBeenCalledTimes(1);
    clock += 2_000;
    await resolveMappedHostScope(req('space-one'), deps);
    expect(findSpaceIds).toHaveBeenCalledTimes(2);
  });

  it('a lookup error propagates: never read as the main app', async () => {
    findSpaceIds.mockRejectedValue(new Error('db down'));
    await expect(
      resolveMappedHostScope(req('space-one'), deps),
    ).rejects.toThrow();
  });

  it('the default lookup is one query on the slug column', async () => {
    findSpace.mockResolvedValue({ id: 3, web3SpaceId: 9 });
    expect(await resolveMappedHostScope(req('space-one'))).toMatchObject({
      kind: 'mapped',
      spaceId: 3,
      web3SpaceId: 9,
    });
    expect(findSpace).toHaveBeenCalledTimes(1);
    expect(findSpace.mock.calls[0]?.[0].columns).toEqual({
      id: true,
      web3SpaceId: true,
    });
  });
});
