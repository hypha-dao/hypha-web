import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
const sentinel = vi.hoisted(() => ({ name: 'server connection' }));
vi.mock('@hypha-platform/storage-postgres', () => ({ db: sentinel }));

import { connectionFor } from '../connection';

describe('connectionFor (the one resolver)', () => {
  it('gives every request the server connection today, whoever acts', () => {
    const person = {
      kind: 'user',
      person: { id: 1 },
      address: null,
    } as never;
    expect(connectionFor({ actor: person })).toBe(sentinel);
    expect(connectionFor({ actor: { kind: 'guest' } })).toBe(sentinel);
    expect(
      connectionFor({ actor: { kind: 'service', name: 'identity' } }),
    ).toBe(sentinel);
  });

  it('accepts a namespace without changing the answer yet', () => {
    expect(
      connectionFor({ actor: { kind: 'guest' }, namespace: 'example' }),
    ).toBe(sentinel);
  });
});
