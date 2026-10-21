import { describe, expect, it, vi } from 'vitest';

import type { IntegrationClientSummary } from '../../integration-client/types';
import { png } from '../../integration-client/__tests__/logo-fixtures';
import {
  handleListMyClients,
  handleRotateMyClientKey,
  handleUploadClientLogo,
  type IntegrationDeveloperDeps,
} from '../developer-handlers';
import type { UserAuthResult } from '../handlers';
import { INTEGRATION_API_RESPONSE_HEADERS } from '../response-headers';

const LOGO_URL = 'https://files.example/logo.png';
const OWNER = { id: 42, email: 'owner@example.com', slug: 'owner' };

const userOk = (user = OWNER): UserAuthResult => ({ ok: true, user });
const userNone: UserAuthResult = {
  ok: false,
  status: 401,
  code: 'missing_token',
  error: 'Unauthorized',
};

const client = (
  over: Partial<IntegrationClientSummary> = {},
): IntegrationClientSummary => ({
  id: 7,
  name: 'Acme',
  slug: 'acme',
  contactEmail: 'acme@example.com',
  description: null,
  status: 'pending',
  scopes: ['agreements:vote'],
  allowedOrigins: ['https://acme.example'],
  keyPrefix: null,
  logoUrl: null,
  requestedByPersonId: OWNER.id,
  approvedAt: null,
  revokedAt: null,
  createdAt: new Date('2026-10-01T00:00:00Z'),
  ...over,
});

function makeDeps(over: Partial<IntegrationDeveloperDeps> = {}) {
  return {
    authenticateUser: vi.fn(async () => userOk()),
    listClientsForPerson: vi.fn(async () => [client()]),
    findClientBySlug: vi.fn(async () => client()),
    storeLogo: vi.fn(async () => LOGO_URL),
    setLogo: vi.fn(async () => true),
    rotateClientKey: vi.fn(async () => ({
      client: client({ status: 'approved', keyPrefix: 'hyp_new' }),
      plaintext: 'hyp_new_secret_value',
    })),
    ...over,
  } satisfies IntegrationDeveloperDeps;
}

const get = (url = 'http://x.test/a') =>
  new Request(url, { headers: { authorization: 'Bearer t' } });

const upload = (bytes: Uint8Array | string, name = 'logo.png') => {
  const form = new FormData();
  form.set('logo', new File([bytes as BlobPart], name, { type: 'image/png' }));
  return new Request('http://x.test/logo', { method: 'POST', body: form });
};

const params = { slug: 'acme' };

describe('GET users/me/clients', () => {
  it('needs a user token', async () => {
    const deps = makeDeps({ authenticateUser: vi.fn(async () => userNone) });
    const res = await handleListMyClients(get(), deps);
    expect(res.status).toBe(401);
    expect(deps.listClientsForPerson).not.toHaveBeenCalled();
  });

  it('lists only the caller’s own clients, from the token', async () => {
    const deps = makeDeps();
    const res = await handleListMyClients(
      get('http://x.test/a?personId=1'),
      deps,
    );
    expect(deps.listClientsForPerson).toHaveBeenCalledWith({
      personId: OWNER.id,
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(1);
    for (const [name, value] of Object.entries(
      INTEGRATION_API_RESPONSE_HEADERS,
    )) {
      expect(res.headers.get(name)).toBe(value);
    }
  });

  it('never exposes the key digest, ids or the contact to the owner', async () => {
    const deps = makeDeps({
      listClientsForPerson: vi.fn(async () => [
        client({ status: 'approved', keyPrefix: 'hyp_ab' }),
      ]),
    });
    const text = await (await handleListMyClients(get(), deps)).text();
    expect(text).not.toMatch(/keyHash|requestedByPersonId|contactEmail|"id"/);
    expect(text).toContain('hyp_ab');
  });

  it('hides a logo that is not approved yet and reports it as in review', async () => {
    const deps = makeDeps({
      listClientsForPerson: vi.fn(async () => [
        client({ status: 'pending', logoUrl: LOGO_URL }),
      ]),
    });
    const res = await handleListMyClients(get(), deps);
    const text = await res.text();
    expect(text).not.toContain(LOGO_URL);
    expect(JSON.parse(text).items[0].logo).toEqual({
      state: 'in_review',
      url: null,
    });
  });

  it('shows the logo once the client is approved', async () => {
    const deps = makeDeps({
      listClientsForPerson: vi.fn(async () => [
        client({ status: 'approved', logoUrl: LOGO_URL }),
      ]),
    });
    const body = await (await handleListMyClients(get(), deps)).json();
    expect(body.items[0].logo).toEqual({ state: 'approved', url: LOGO_URL });
  });

  it('a revoked client’s logo is not shown either', async () => {
    const deps = makeDeps({
      listClientsForPerson: vi.fn(async () => [
        client({ status: 'revoked', logoUrl: LOGO_URL }),
      ]),
    });
    expect(await (await handleListMyClients(get(), deps)).text()).not.toContain(
      LOGO_URL,
    );
  });
});

describe('POST users/me/clients/{slug}/logo', () => {
  it('needs a user token', async () => {
    const deps = makeDeps({ authenticateUser: vi.fn(async () => userNone) });
    const res = await handleUploadClientLogo(upload(png(64, 64)), params, deps);
    expect(res.status).toBe(401);
    expect(deps.storeLogo).not.toHaveBeenCalled();
  });

  it('stores a valid logo and says it is in review, without its address', async () => {
    const deps = makeDeps();
    const res = await handleUploadClientLogo(upload(png(64, 64)), params, deps);
    expect(res.status).toBe(201);
    const text = await res.text();
    expect(text).not.toContain(LOGO_URL);
    expect(JSON.parse(text)).toEqual({ logo: { state: 'in_review' } });
    expect(deps.storeLogo).toHaveBeenCalledWith(
      expect.objectContaining({ slug: 'acme', type: 'png', mime: 'image/png' }),
    );
    expect(deps.setLogo).toHaveBeenCalledWith({
      slug: 'acme',
      requestedByPersonId: OWNER.id,
      logoUrl: LOGO_URL,
    });
  });

  it.each([
    ['an SVG, even named .png', '<svg xmlns="http://www.w3.org/2000/svg"/>'],
    ['a text file', 'not an image at all'],
    ['a PNG that is far from square', png(400, 64)],
    ['a PNG over the size cap', png(64, 64, 5 * 1024 * 1024)],
  ])('refuses %s before storing anything', async (_label, content) => {
    const deps = makeDeps();
    const res = await handleUploadClientLogo(upload(content), params, deps);
    expect([400, 413]).toContain(res.status);
    expect(deps.storeLogo).not.toHaveBeenCalled();
    expect(deps.setLogo).not.toHaveBeenCalled();
  });

  it('refuses a request without the logo field', async () => {
    const deps = makeDeps();
    const form = new FormData();
    form.set('other', 'x');
    const res = await handleUploadClientLogo(
      new Request('http://x.test/logo', { method: 'POST', body: form }),
      params,
      deps,
    );
    expect(res.status).toBe(400);
    expect(deps.storeLogo).not.toHaveBeenCalled();
  });

  it('is a 404 for someone else’s client, an unknown one or one already answered', async () => {
    for (const found of [
      client({ requestedByPersonId: 999 }),
      client({ status: 'approved' }),
      client({ status: 'revoked' }),
      null,
    ]) {
      const deps = makeDeps({ findClientBySlug: vi.fn(async () => found) });
      const res = await handleUploadClientLogo(
        upload(png(64, 64)),
        params,
        deps,
      );
      expect(res.status).toBe(404);
      expect(deps.storeLogo).not.toHaveBeenCalled();
    }
  });

  it('does not attach the logo when the request is answered during the upload', async () => {
    const deps = makeDeps({ setLogo: vi.fn(async () => false) });
    const res = await handleUploadClientLogo(upload(png(64, 64)), params, deps);
    expect(res.status).toBe(404);
  });

  it('answers a storage failure with no detail', async () => {
    const deps = makeDeps({
      storeLogo: vi.fn(async () => {
        throw new Error('token abc123 rejected');
      }),
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handleUploadClientLogo(upload(png(64, 64)), params, deps);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('abc123');
  });
});

describe('POST users/me/clients/{slug}/rotate-key', () => {
  const approved = () => client({ status: 'approved' });
  const post = () =>
    new Request('http://x.test/rotate', {
      method: 'POST',
      headers: { authorization: 'Bearer t' },
    });

  it('needs a user token', async () => {
    const deps = makeDeps({ authenticateUser: vi.fn(async () => userNone) });
    const res = await handleRotateMyClientKey(post(), params, deps);
    expect(res.status).toBe(401);
    expect(deps.rotateClientKey).not.toHaveBeenCalled();
  });

  it('gives the owner of an approved client a new key, once', async () => {
    const deps = makeDeps({ findClientBySlug: vi.fn(async () => approved()) });
    const res = await handleRotateMyClientKey(post(), params, deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.clientKey).toBe('hyp_new_secret_value');
    expect(deps.rotateClientKey).toHaveBeenCalledWith({ slug: 'acme' });
  });

  it('is a 404 for someone else’s client, a pending, revoked or unknown one', async () => {
    for (const found of [
      { ...approved(), requestedByPersonId: 999 },
      client({ status: 'pending' }),
      client({ status: 'revoked' }),
      null,
    ]) {
      const deps = makeDeps({ findClientBySlug: vi.fn(async () => found) });
      const res = await handleRotateMyClientKey(post(), params, deps);
      expect(res.status).toBe(404);
      expect(deps.rotateClientKey).not.toHaveBeenCalled();
    }
  });

  it('answers a failure with no detail and does not log the key', async () => {
    const deps = makeDeps({
      findClientBySlug: vi.fn(async () => approved()),
      rotateClientKey: vi.fn(async () => {
        throw new Error('db password abc123');
      }),
    });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const res = await handleRotateMyClientKey(post(), params, deps);
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(await res.text()).not.toContain('abc123');
  });
});
