import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ headers: new Headers() }));

vi.mock('next/headers', () => ({ headers: async () => state.headers }));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NEXT_NOT_FOUND');
  },
}));

import { WL_AUTH_HEADER, WL_CREATE_ACTIONS_HEADER, WL_MODE_HEADER } from '..';
import { requireCreateAction } from '../require-create-action';

const AUTH = JSON.stringify({
  privyClientId: 'client-1',
  cookieDomain: 'login.example',
});
const set = (entries: Record<string, string>) => {
  state.headers = new Headers(entries);
};

describe('requireCreateAction', () => {
  beforeEach(() => set({}));

  it('serves a host with login that enabled the action', async () => {
    set({
      [WL_MODE_HEADER]: 'host',
      [WL_AUTH_HEADER]: AUTH,
      [WL_CREATE_ACTIONS_HEADER]: 'signal',
    });
    await expect(requireCreateAction('signal')).resolves.toBeUndefined();
    await expect(
      requireCreateAction('agreement', 'signal'),
    ).resolves.toBeUndefined();
  });

  it('404s when the action is not enabled', async () => {
    set({
      [WL_MODE_HEADER]: 'host',
      [WL_AUTH_HEADER]: AUTH,
      [WL_CREATE_ACTIONS_HEADER]: 'agreement',
    });
    await expect(requireCreateAction('signal')).rejects.toThrow('NOT_FOUND');
  });

  it('404s without login, in the frame, or with no or bad headers', async () => {
    const cases: Record<string, string>[] = [
      { [WL_MODE_HEADER]: 'host', [WL_CREATE_ACTIONS_HEADER]: 'signal' },
      {
        [WL_MODE_HEADER]: 'embed',
        [WL_AUTH_HEADER]: AUTH,
        [WL_CREATE_ACTIONS_HEADER]: 'signal',
      },
      {
        [WL_MODE_HEADER]: 'host',
        [WL_AUTH_HEADER]: 'nope',
        [WL_CREATE_ACTIONS_HEADER]: 'signal',
      },
      {
        [WL_MODE_HEADER]: 'host',
        [WL_AUTH_HEADER]: AUTH,
        [WL_CREATE_ACTIONS_HEADER]: 'all,*,Signal',
      },
      {},
    ];
    for (const entries of cases) {
      set(entries);
      await expect(requireCreateAction('signal')).rejects.toThrow('NOT_FOUND');
    }
  });
});
