import { describe, expect, it } from 'vitest';

import { resolve, type ResolveOptions, type WhiteLabelConfig } from '..';

const base: ResolveOptions = { locales: ['en'], defaultLocale: 'en' };
const config: WhiteLabelConfig = {
  clients: [],
  hostClients: [
    { id: 'ro', hosts: [{ host: 'ro.example', spaceSlug: 's1' }] },
    {
      id: 'login',
      hosts: [
        {
          host: 'login.example',
          spaceSlug: 's1',
          authConfig: {
            privyClientId: 'client-1',
            cookieDomain: 'login.example',
          },
        },
      ],
    },
  ],
  mainHosts: ['app.example'],
};
const call = (host: string, path: string, method: string) =>
  resolve(host, path, config, { ...base, method });

describe('/api/uploadthing on a mapped host', () => {
  it('host with login: GET (route config) and POST (upload) reach the route', () => {
    for (const method of ['GET', 'POST']) {
      expect(call('login.example', '/api/uploadthing', method)).toEqual({
        kind: 'api-allow',
        spaceSlug: 's1',
      });
    }
  });

  it('read-only host: refused, both methods', () => {
    for (const method of ['GET', 'POST']) {
      expect(call('ro.example', '/api/uploadthing', method)).toEqual({
        kind: 'not-found',
        reason: 'api-not-allowed',
      });
    }
  });

  it('only that one path takes a POST; other methods stay refused', () => {
    for (const path of [
      '/api/v1/spaces/s1',
      '/api/v1/people/me',
      '/api/uploadthing/x',
      '/api/v1/uploadthing',
    ]) {
      expect(call('login.example', path, 'POST').kind, path).toBe('not-found');
    }
    for (const method of ['PUT', 'DELETE', 'PATCH']) {
      expect(call('login.example', '/api/uploadthing', method).kind).toBe(
        'not-found',
      );
    }
  });
});
