import { describe, expect, it } from 'vitest';

import {
  WL_REQUEST_HEADERS,
  resolve,
  type ResolveOptions,
  type WhiteLabelConfig,
} from '..';

const base: ResolveOptions = { locales: ['en', 'pt'], defaultLocale: 'en' };

const config: WhiteLabelConfig = {
  clients: [
    {
      id: 'f1',
      spaces: [{ slug: 's1', framingOrigins: ['https://partner.example'] }],
    },
  ],
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

const call = (host: string, path: string, method?: string) =>
  resolve(host, path, config, { ...base, method });

const refused = { kind: 'not-found', reason: 'method-not-allowed' };

describe('writes to a page of a read-only delivery', () => {
  it('read-only host: any method but GET/HEAD is refused', () => {
    for (const method of [
      'POST',
      'PUT',
      'PATCH',
      'DELETE',
      'OPTIONS',
      'post',
    ]) {
      expect(call('ro.example', '/agreements', method), method).toEqual(
        refused,
      );
      expect(call('ro.example', '/en/coherence/signal/x', method)).toEqual(
        refused,
      );
    }
  });

  it('read-only host: GET, HEAD and no method are served', () => {
    for (const method of ['GET', 'HEAD', 'get', undefined]) {
      expect(call('ro.example', '/agreements', method).kind).toBe('rewrite');
    }
  });

  it('the frame refuses writes too, and still serves reads', () => {
    expect(call('app.example', '/embed/s1/en/agreements', 'POST')).toEqual(
      refused,
    );
    expect(call('app.example', '/embed/s1/en/agreements', 'GET').kind).toBe(
      'rewrite',
    );
  });

  it('login host: a POST to a page is served (actions authorise by bearer)', () => {
    expect(call('login.example', '/agreements', 'POST').kind).toBe('rewrite');
  });

  it('main host paths are unchanged', () => {
    expect(call('app.example', '/en/dho/s1/agreements', 'POST')).toEqual({
      kind: 'pass',
    });
  });

  it('a forged Next-Action header cannot matter: only host, path and method decide', () => {
    expect(call('ro.example', '/agreements', 'GET').kind).toBe('rewrite');
    expect(call('ro.example', '/agreements', 'POST')).toEqual(refused);
    expect(WL_REQUEST_HEADERS).not.toContain('next-action');
  });

  it('existing refusals keep their reasons (api, internal prefix)', () => {
    expect(call('ro.example', '/api/v1/spaces/s1', 'POST')).toEqual({
      kind: 'not-found',
      reason: 'api-not-allowed',
    });
    expect(call('ro.example', '/wl/s1/en/agreements', 'POST')).toEqual({
      kind: 'not-found',
      reason: 'internal-prefix',
    });
  });
});
