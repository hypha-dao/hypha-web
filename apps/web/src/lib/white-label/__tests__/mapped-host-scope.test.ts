import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  resetMappedHostScopeCache,
  resolveMappedHostScope,
} from '../mapped-host-scope';
import { WL_SPACE_HEADER } from '../constants';

const findSpace = vi.fn();
/** Fake database config: only the one query the helper makes. */
const dbConfig = {
  db: { query: { spaces: { findFirst: findSpace } } },
} as never;

const req = (slug?: string) => ({
  headers: new Headers(slug ? { [WL_SPACE_HEADER]: slug } : {}),
});

describe('resolveMappedHostScope', () => {
  let clock = 0;
  const now = () => clock;
  const resolve = (slug?: string) =>
    resolveMappedHostScope(req(slug), dbConfig, now);

  beforeEach(() => {
    resetMappedHostScopeCache();
    clock = 1_000;
    findSpace.mockReset();
  });

  it('no header: main app, no lookup', async () => {
    expect(await resolve()).toEqual({ kind: 'main' });
    expect(findSpace).not.toHaveBeenCalled();
  });

  it('header present: resolves the slug to both ids with one query on the slug column', async () => {
    findSpace.mockResolvedValue({ id: 7, web3SpaceId: 42 });
    expect(await resolve('space-one')).toEqual({
      kind: 'mapped',
      slug: 'space-one',
      spaceId: 7,
      web3SpaceId: 42,
    });
    expect(findSpace).toHaveBeenCalledTimes(1);
    expect(findSpace.mock.calls[0]?.[0].columns).toEqual({
      id: true,
      web3SpaceId: true,
    });
  });

  it('unknown slug: fails closed and is not cached', async () => {
    findSpace.mockResolvedValue(undefined);
    expect(await resolve('nope')).toEqual({ kind: 'unknown-space' });
    findSpace.mockResolvedValue({ id: 1, web3SpaceId: null });
    expect((await resolve('nope')).kind).toBe('mapped');
    expect(findSpace).toHaveBeenCalledTimes(2);
  });

  it('caches a found Space briefly, then looks it up again', async () => {
    findSpace.mockResolvedValue({ id: 7, web3SpaceId: 42 });
    await resolve('space-one');
    clock += 29_000;
    await resolve('space-one');
    expect(findSpace).toHaveBeenCalledTimes(1);
    clock += 2_000;
    await resolve('space-one');
    expect(findSpace).toHaveBeenCalledTimes(2);
  });

  it('a lookup error propagates: never read as the main app', async () => {
    findSpace.mockRejectedValue(new Error('db down'));
    await expect(resolve('space-one')).rejects.toThrow();
  });
});
