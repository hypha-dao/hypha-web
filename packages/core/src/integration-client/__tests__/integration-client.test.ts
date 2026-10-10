import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../server/queries', () => ({
  findIntegrationClientByKeyHash: vi.fn(),
}));

import {
  generateClientKey,
  hashClientKey,
  INTEGRATION_CLIENT_KEY_PREFIX,
  safeEqualClientKeyHashes,
} from '../generate-client-key';
import {
  authenticateIntegrationClient,
  INTEGRATION_CLIENT_KEY_HEADER,
} from '../server/authenticate-client';
import { findIntegrationClientByKeyHash } from '../server/queries';
import { canTransitionClientStatus } from '../types';
import {
  schemaRequestIntegrationClient,
  slugifyClientName,
} from '../validation';

const db = {} as never;

function clientRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 3,
    name: 'Argonauts',
    slug: 'argonauts',
    status: 'approved',
    scopes: ['agreements:vote'],
    keyHash: 'unset',
    ...overrides,
  };
}

function requestWith(headers: Record<string, string>) {
  return new Request('https://hypha.test/api/v1/x', { headers });
}

describe('generateClientKey', () => {
  it('produces a namespaced key whose digest matches the plaintext', () => {
    const { plaintext, prefix, hash } = generateClientKey();
    expect(
      plaintext.startsWith(`${INTEGRATION_CLIENT_KEY_PREFIX}_${prefix}_`),
    ).toBe(true);
    expect(hash).toBe(hashClientKey(plaintext));
    expect(hash).toHaveLength(64);
  });

  it('never repeats', () => {
    expect(generateClientKey().plaintext).not.toBe(
      generateClientKey().plaintext,
    );
  });

  it('compares digests safely', () => {
    expect(safeEqualClientKeyHashes('ab', 'ab')).toBe(true);
    expect(safeEqualClientKeyHashes('ab', 'ac')).toBe(false);
    expect(safeEqualClientKeyHashes('ab', 'abc')).toBe(false);
  });
});

describe('canTransitionClientStatus', () => {
  it('allows the lifecycle and nothing else', () => {
    expect(canTransitionClientStatus('pending', 'approved')).toBe(true);
    expect(canTransitionClientStatus('pending', 'revoked')).toBe(true);
    expect(canTransitionClientStatus('approved', 'revoked')).toBe(true);
    expect(canTransitionClientStatus('approved', 'pending')).toBe(false);
    expect(canTransitionClientStatus('revoked', 'approved')).toBe(false);
  });
});

describe('request validation', () => {
  const valid = {
    name: 'Argonauts',
    contactEmail: 'team@example.com',
    scopes: ['agreements:vote'],
    allowedOrigins: ['https://app.example.com'],
  };

  it('accepts a valid request and defaults origins', () => {
    expect(schemaRequestIntegrationClient.safeParse(valid).success).toBe(true);
    const { allowedOrigins, ...rest } = valid;
    void allowedOrigins;
    const parsed = schemaRequestIntegrationClient.parse(rest);
    expect(parsed.allowedOrigins).toEqual([]);
  });

  it('rejects unknown scopes, bad emails and non-origin URLs', () => {
    expect(
      schemaRequestIntegrationClient.safeParse({ ...valid, scopes: ['admin'] })
        .success,
    ).toBe(false);
    expect(
      schemaRequestIntegrationClient.safeParse({ ...valid, contactEmail: 'x' })
        .success,
    ).toBe(false);
    for (const bad of [
      'https://app.example.com/path',
      'https://app.example.com/',
      'http://app.example.com',
      'not a url',
    ]) {
      expect(
        schemaRequestIntegrationClient.safeParse({
          ...valid,
          allowedOrigins: [bad],
        }).success,
      ).toBe(false);
    }
    expect(
      schemaRequestIntegrationClient.safeParse({
        ...valid,
        allowedOrigins: ['http://localhost:3000'],
      }).success,
    ).toBe(true);
  });

  it('derives a slug', () => {
    expect(slugifyClientName('  The Argonauts! ')).toBe('the-argonauts');
    expect(slugifyClientName('!!!')).toBe('client');
    // A combining accent must not turn into a separator.
    expect(slugifyClientName('CaféLabs')).toBe('cafelabs');
    expect(slugifyClientName('Café Labs')).toBe('cafe-labs');
  });
});

describe('authenticateIntegrationClient', () => {
  beforeEach(() => vi.clearAllMocks());

  const opts = { requiredScope: 'agreements:vote' as const };

  it('rejects a missing key, and ignores a Bearer token', async () => {
    const result = await authenticateIntegrationClient(
      { request: requestWith({ authorization: 'Bearer hyc_x_y' }), ...opts },
      { db },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      code: 'missing_key',
    });
    expect(findIntegrationClientByKeyHash).not.toHaveBeenCalled();
  });

  it('rejects an unknown key', async () => {
    vi.mocked(findIntegrationClientByKeyHash).mockResolvedValue(null);
    const result = await authenticateIntegrationClient(
      {
        request: requestWith({ [INTEGRATION_CLIENT_KEY_HEADER]: 'nope' }),
        ...opts,
      },
      { db },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 401,
      code: 'invalid_key',
    });
  });

  it('rejects a revoked or pending client distinctly from an unknown key', async () => {
    const { plaintext, hash } = generateClientKey();
    vi.mocked(findIntegrationClientByKeyHash).mockResolvedValue(
      clientRow({ keyHash: hash, status: 'revoked' }) as never,
    );
    const result = await authenticateIntegrationClient(
      {
        request: requestWith({ [INTEGRATION_CLIENT_KEY_HEADER]: plaintext }),
        ...opts,
      },
      { db },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: 'client_not_approved',
    });
  });

  it('rejects a missing scope', async () => {
    const { plaintext, hash } = generateClientKey();
    vi.mocked(findIntegrationClientByKeyHash).mockResolvedValue(
      clientRow({ keyHash: hash, scopes: [] }) as never,
    );
    const result = await authenticateIntegrationClient(
      {
        request: requestWith({ [INTEGRATION_CLIENT_KEY_HEADER]: plaintext }),
        ...opts,
      },
      { db },
    );
    expect(result).toMatchObject({
      ok: false,
      status: 403,
      code: 'missing_scope',
    });
  });

  it('accepts an approved client with the scope', async () => {
    const { plaintext, hash } = generateClientKey();
    vi.mocked(findIntegrationClientByKeyHash).mockResolvedValue(
      clientRow({ keyHash: hash }) as never,
    );
    const result = await authenticateIntegrationClient(
      {
        request: requestWith({ [INTEGRATION_CLIENT_KEY_HEADER]: plaintext }),
        ...opts,
      },
      { db },
    );
    expect(result).toEqual({
      ok: true,
      client: {
        id: 3,
        slug: 'argonauts',
        name: 'Argonauts',
        scopes: ['agreements:vote'],
      },
    });
  });
});
