import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { buildMyProfileV2 } from '../people';
import type { V2Caller } from '../access';

const caller = {
  kind: 'user',
  person: {
    id: 7,
    sub: 'did:privy:secret',
    email: 'pat@example.com',
    name: 'Pat',
    surname: 'Lee',
    slug: 'pat-lee',
    avatarUrl: 'https://img.example/pat.png',
    address: '0xabc',
    preferredCurrency: 'EUR',
  },
  address: '0xabc',
} as unknown as V2Caller;

describe('buildMyProfileV2', () => {
  it('returns only name, surname, slug and avatarUrl by default', () => {
    const r = buildMyProfileV2({ caller, includeAddress: false });
    expect(r).toEqual({
      ok: true,
      body: {
        name: 'Pat',
        surname: 'Lee',
        slug: 'pat-lee',
        avatarUrl: 'https://img.example/pat.png',
      },
    });
    const text = JSON.stringify(r);
    for (const secret of ['pat@example.com', 'did:privy', '0xabc', 'EUR']) {
      expect(text).not.toContain(secret);
    }
  });

  it('adds the wallet address only when asked', () => {
    const r = buildMyProfileV2({ caller, includeAddress: true });
    expect(r).toMatchObject({ ok: true, body: { address: '0xabc' } });
  });

  it('uses null for what the person has not set', () => {
    const bare = {
      kind: 'user',
      person: { id: 1 },
      address: null,
    } as unknown as V2Caller;
    expect(buildMyProfileV2({ caller: bare, includeAddress: true })).toEqual({
      ok: true,
      body: {
        name: null,
        surname: null,
        slug: null,
        avatarUrl: null,
        address: null,
      },
    });
  });

  it('401 for a guest', () => {
    expect(
      buildMyProfileV2({ caller: { kind: 'guest' }, includeAddress: false }),
    ).toMatchObject({ ok: false, status: 401 });
  });
});
