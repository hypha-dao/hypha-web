import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/queries', () => ({
  findActiveSpaceApiKeyByHash: vi.fn(),
}));
vi.mock('../server/mutations', () => ({
  touchSpaceApiKeyLastUsed: vi.fn(),
}));

import {
  generateSpaceApiKey,
  hashSpaceApiKey,
  safeEqualHashes,
  SPACE_API_KEY_PREFIX,
} from '../generate-api-key';
import {
  authenticateSpaceApiKey,
  SPACE_API_KEY_HEADER,
} from '../server/authenticate-space-api-key';
import { findActiveSpaceApiKeyByHash } from '../server/queries';
import { touchSpaceApiKeyLastUsed } from '../server/mutations';

const db = {} as never;

function keyRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 7,
    spaceId: 42,
    name: 'Contest app',
    source: 'contest-app',
    keyPrefix: 'abcd1234',
    keyHash: 'unset',
    scopes: ['signals:write'],
    createdByPersonId: null,
    lastUsedAt: null,
    revokedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function requestWithKey(key: string, header = SPACE_API_KEY_HEADER) {
  return new Request('https://hypha.test/api/v1/spaces/acme/signals', {
    method: 'POST',
    headers: { [header]: key },
  });
}

describe('generateSpaceApiKey', () => {
  it('produces a namespaced key whose digest matches the plaintext', () => {
    const { plaintext, prefix, hash } = generateSpaceApiKey();

    expect(plaintext.startsWith(`${SPACE_API_KEY_PREFIX}_${prefix}_`)).toBe(
      true,
    );
    expect(hash).toBe(hashSpaceApiKey(plaintext));
    expect(hash).toHaveLength(64);
  });

  it('never repeats a key', () => {
    const keys = new Set(
      Array.from({ length: 50 }, () => generateSpaceApiKey().plaintext),
    );
    expect(keys.size).toBe(50);
  });

  it('ignores surrounding whitespace when hashing', () => {
    const { plaintext, hash } = generateSpaceApiKey();
    expect(hashSpaceApiKey(`  ${plaintext}\n`)).toBe(hash);
  });
});

describe('safeEqualHashes', () => {
  it('rejects digests of differing length instead of throwing', () => {
    expect(safeEqualHashes('abc', 'abcd')).toBe(false);
  });

  it('accepts identical digests', () => {
    const hash = hashSpaceApiKey('hyk_test_key');
    expect(safeEqualHashes(hash, hash)).toBe(true);
  });
});

describe('authenticateSpaceApiKey', () => {
  const mockedLookup = vi.mocked(findActiveSpaceApiKeyByHash);
  const mockedTouch = vi.mocked(touchSpaceApiKeyLastUsed);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticates a valid key and records its use', async () => {
    const { plaintext, hash } = generateSpaceApiKey();
    mockedLookup.mockResolvedValue(keyRow({ keyHash: hash }) as never);

    const result = await authenticateSpaceApiKey(
      {
        request: requestWithKey(plaintext),
        spaceId: 42,
        requiredScope: 'signals:write',
      },
      { db },
    );

    expect(result).toMatchObject({
      ok: true,
      apiKey: { id: 7, spaceId: 42, source: 'contest-app' },
    });
    expect(mockedLookup).toHaveBeenCalledWith({ keyHash: hash }, { db });
    expect(mockedTouch).toHaveBeenCalledWith({ id: 7 }, { db });
  });

  it('accepts the key as a bearer token too', async () => {
    const { plaintext, hash } = generateSpaceApiKey();
    mockedLookup.mockResolvedValue(keyRow({ keyHash: hash }) as never);

    const request = new Request('https://hypha.test/x', {
      method: 'POST',
      headers: { authorization: `Bearer ${plaintext}` },
    });

    const result = await authenticateSpaceApiKey(
      { request, spaceId: 42, requiredScope: 'signals:write' },
      { db },
    );

    expect(result.ok).toBe(true);
  });

  it('returns 401 when no key is presented', async () => {
    const request = new Request('https://hypha.test/x', { method: 'POST' });

    const result = await authenticateSpaceApiKey(
      { request, spaceId: 42, requiredScope: 'signals:write' },
      { db },
    );

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(mockedLookup).not.toHaveBeenCalled();
  });

  it('returns 401 for an unknown or revoked key', async () => {
    // The query filters out revoked rows, so both cases surface as no row.
    mockedLookup.mockResolvedValue(null);

    const result = await authenticateSpaceApiKey(
      {
        request: requestWithKey(generateSpaceApiKey().plaintext),
        spaceId: 42,
        requiredScope: 'signals:write',
      },
      { db },
    );

    expect(result).toMatchObject({ ok: false, status: 401 });
    expect(mockedTouch).not.toHaveBeenCalled();
  });

  it('returns 403 when the key belongs to another space', async () => {
    const { plaintext, hash } = generateSpaceApiKey();
    mockedLookup.mockResolvedValue(
      keyRow({ keyHash: hash, spaceId: 99 }) as never,
    );

    const result = await authenticateSpaceApiKey(
      {
        request: requestWithKey(plaintext),
        spaceId: 42,
        requiredScope: 'signals:write',
      },
      { db },
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
    expect(mockedTouch).not.toHaveBeenCalled();
  });

  it('returns 403 when the key lacks the required scope', async () => {
    const { plaintext, hash } = generateSpaceApiKey();
    mockedLookup.mockResolvedValue(
      keyRow({ keyHash: hash, scopes: ['signals:write'] }) as never,
    );

    const result = await authenticateSpaceApiKey(
      {
        request: requestWithKey(plaintext),
        spaceId: 42,
        requiredScope: 'signals:upvote',
      },
      { db },
    );

    expect(result).toMatchObject({ ok: false, status: 403 });
    if (!result.ok) {
      expect(result.error).toContain('signals:upvote');
    }
  });

  it('rejects a row whose stored digest does not match the presented key', async () => {
    const { plaintext } = generateSpaceApiKey();
    mockedLookup.mockResolvedValue(
      keyRow({ keyHash: hashSpaceApiKey('a-different-key') }) as never,
    );

    const result = await authenticateSpaceApiKey(
      {
        request: requestWithKey(plaintext),
        spaceId: 42,
        requiredScope: 'signals:write',
      },
      { db },
    );

    expect(result).toMatchObject({ ok: false, status: 401 });
  });
});
