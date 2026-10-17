import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  V2_RESPONSE_HEADERS,
  applyV2Headers,
  withV2Headers,
} from '../response-headers';

const V2_ROUTES_DIR = resolve(
  __dirname,
  '../../../../../apps/web/src/app/api/v2',
);
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

const expectV2Headers = (response: Response) => {
  expect(response.headers.get('Cache-Control')).toBe(
    V2_RESPONSE_HEADERS['Cache-Control'],
  );
  expect(response.headers.get('Vary')).toBe(V2_RESPONSE_HEADERS.Vary);
};

describe('withV2Headers: every response class carries the v2 headers', () => {
  const unhandled = () => new Response('{}', { status: 500 });

  it.each([200, 204, 400, 401, 403, 404, 502, 500])(
    'status %i from the handler',
    async (status) => {
      const handler = withV2Headers(
        async () => new Response(status === 204 ? null : '{}', { status }),
        unhandled,
      );
      const response = await handler();
      expect(response.status).toBe(status);
      expectV2Headers(response);
    },
  );

  it('replaces a looser Cache-Control set by the handler', async () => {
    const handler = withV2Headers(
      async () =>
        new Response('{}', {
          headers: { 'Cache-Control': 'public, max-age=600', Vary: '*' },
        }),
      unhandled,
    );
    expectV2Headers(await handler());
  });

  it('answers an exception that escaped the handler with a 500 that has the headers', async () => {
    const onUnhandled = vi.fn(() => new Response('{}', { status: 500 }));
    const handler = withV2Headers(async () => {
      throw new Error('boom');
    }, onUnhandled);
    const response = await handler();
    expect(response.status).toBe(500);
    expect(onUnhandled).toHaveBeenCalledOnce();
    expectV2Headers(response);
  });

  it('applyV2Headers works on a bare response', () => {
    expectV2Headers(applyV2Headers(new Response('{}')));
  });
});

describe('v2 route files cannot bypass the wrapper', () => {
  const files = routeFiles(V2_ROUTES_DIR);

  it('finds the v2 routes', () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files.map((f) => [f.slice(V2_ROUTES_DIR.length), f]))(
    '%s exports every method through v2Route and builds no response itself',
    (_name, file) => {
      const source = readFileSync(file, 'utf8');
      // No directly exported handler function: methods go through v2Route.
      expect(source).not.toMatch(
        /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
      );
      const exported = [
        ...source.matchAll(
          /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=\s*(\w+)\(/g,
        ),
      ];
      expect(exported.length).toBeGreaterThan(0);
      for (const [, , wrapper] of exported) expect(wrapper).toBe('v2Route');
      // Responses come from jsonV2 / failureResponse, never NextResponse or Response directly.
      expect(source).not.toMatch(
        /NextResponse|new Response\(|Response\.json\(/,
      );
    },
  );
});

describe('next.config safety net for framework-built v2 responses', () => {
  it('sets the same values as V2_RESPONSE_HEADERS on /api/v2', () => {
    const source = readFileSync(NEXT_CONFIG, 'utf8');
    expect(source).toContain("source: '/api/v2/:path*'");
    expect(source).toContain(
      `{ key: 'Cache-Control', value: '${V2_RESPONSE_HEADERS['Cache-Control']}' }`,
    );
    expect(source).toContain(
      `{ key: 'Vary', value: '${V2_RESPONSE_HEADERS.Vary}' }`,
    );
  });
});
