import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  INTEGRATION_API_RESPONSE_HEADERS,
  applyIntegrationApiHeaders,
  integrationJson,
  withIntegrationApiHeaders,
} from '../response-headers';

const API_DIR = resolve(__dirname, '../../../../../apps/web/src/app/api');
const ROUTES_DIR = join(API_DIR, 'integration');
const NEXT_CONFIG = resolve(
  __dirname,
  '../../../../../apps/web/next.config.ts',
);

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return routeFiles(path);
    return name === 'route.ts' ? [path] : [];
  });
}

const expectHeaders = (response: Response) => {
  expect(response.headers.get('Cache-Control')).toBe(
    INTEGRATION_API_RESPONSE_HEADERS['Cache-Control'],
  );
  expect(response.headers.get('Vary')).toBe(
    INTEGRATION_API_RESPONSE_HEADERS.Vary,
  );
};

describe('withIntegrationApiHeaders: every response class carries the headers', () => {
  const unhandled = () => new Response('{}', { status: 500 });

  it.each([200, 202, 204, 400, 401, 403, 404, 409, 429, 500, 503])(
    'status %i from the handler',
    async (status) => {
      const handler = withIntegrationApiHeaders(
        async () => new Response(status === 204 ? null : '{}', { status }),
        unhandled,
      );
      const response = await handler();
      expect(response.status).toBe(status);
      expectHeaders(response);
    },
  );

  it('replaces a looser Cache-Control set by the handler', async () => {
    const handler = withIntegrationApiHeaders(
      async () =>
        new Response('{}', {
          headers: { 'Cache-Control': 'public, max-age=600', Vary: '*' },
        }),
      unhandled,
    );
    expectHeaders(await handler());
  });

  it('answers an escaped exception with the headers and no detail', async () => {
    const handler = withIntegrationApiHeaders(
      async () => {
        throw new Error('secret detail');
      },
      () => integrationJson({ error: 'Internal error' }, { status: 500 }),
    );
    const response = await handler();
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('secret detail');
    expectHeaders(response);
  });

  it('applyIntegrationApiHeaders works on any response', () => {
    expectHeaders(applyIntegrationApiHeaders(new Response('x')));
    expectHeaders(integrationJson({ ok: true }));
  });
});

describe('integration route files', () => {
  const files = routeFiles(ROUTES_DIR);

  it('finds the routes', () => {
    expect(files.length).toBeGreaterThanOrEqual(10);
  });

  it.each(files.map((f) => [relative(API_DIR, f), f]))(
    '%s exports only through integrationRoute and builds no raw response',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      const exported = [
        ...source.matchAll(
          /^export const (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b([^=]*)=\s*([^\n(]+)/gm,
        ),
      ];
      expect(exported.length).toBeGreaterThan(0);
      for (const match of exported) {
        expect(match[3]).toBe('integrationRoute');
      }
      expect(source).not.toMatch(
        /^export (async )?function (GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/m,
      );
      expect(source).not.toMatch(
        /NextResponse|new Response\(|Response\.json\(/,
      );
    },
  );

  it('no path or handler names the identity provider', () => {
    for (const file of files) {
      expect(relative(API_DIR, file)).not.toMatch(/privy/i);
    }
    const handlers = readFileSync(resolve(__dirname, '../handlers.ts'), 'utf8');
    expect(handlers).not.toMatch(/privy/i);
  });

  it('the retired v1 integration routes are gone', () => {
    for (const gone of [
      'v1/integration-clients',
      'v1/integration-grants',
      'v1/ops/integration-clients',
    ]) {
      expect(existsSync(join(API_DIR, gone))).toBe(false);
    }
  });

  it('next.config.ts carries the same values as the constant', () => {
    const config = readFileSync(NEXT_CONFIG, 'utf8');
    const block = config.slice(config.indexOf("'/api/integration/:path*'"));
    expect(block).toContain(
      `value: '${INTEGRATION_API_RESPONSE_HEADERS['Cache-Control']}'`,
    );
    expect(block).toContain(
      `value: '${INTEGRATION_API_RESPONSE_HEADERS.Vary}'`,
    );
  });
});
