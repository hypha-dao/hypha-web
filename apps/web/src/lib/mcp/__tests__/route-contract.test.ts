import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { MCP_RESPONSE_HEADERS, applyMcpHeaders, mcpRoute } from '../headers';

const WEB = resolve(__dirname, '../../../..');
const read = (path: string) => readFileSync(resolve(WEB, path), 'utf8');

const expectHeaders = (response: Response) => {
  expect(response.headers.get('Cache-Control')).toBe(
    MCP_RESPONSE_HEADERS['Cache-Control'],
  );
  expect(response.headers.get('Vary')).toBe(MCP_RESPONSE_HEADERS.Vary);
};

describe('mcpRoute: every response class carries the MCP headers', () => {
  const unhandled = () => new Response('{}', { status: 500 });

  it.each([200, 204, 400, 401, 403, 404, 405, 429, 500, 503])(
    'status %i',
    async (status) => {
      const handler = mcpRoute(
        async () => new Response(status === 204 ? null : '{}', { status }),
        unhandled,
      );
      const response = await handler();
      expect(response.status).toBe(status);
      expectHeaders(response);
    },
  );

  it('replaces a looser Cache-Control and Vary', async () => {
    const handler = mcpRoute(
      async () =>
        new Response('{}', {
          headers: { 'Cache-Control': 'public, max-age=600', Vary: '*' },
        }),
      unhandled,
    );
    expectHeaders(await handler());
  });

  it('an escaped exception is a 500 with the headers', async () => {
    const handler = mcpRoute(async () => {
      throw new Error('boom');
    }, unhandled);
    const response = await handler();
    expect(response.status).toBe(500);
    expectHeaders(response);
  });

  it('works on a bare response', () => {
    expectHeaders(applyMcpHeaders(new Response('{}')));
  });
});

describe('MCP route files cannot bypass the wrapper', () => {
  it.each([
    'src/app/mcp/route.ts',
    'src/app/.well-known/oauth-protected-resource/mcp/route.ts',
  ])(
    '%s exports every method from the handlers and builds no response itself',
    (file) => {
      const source = read(file);
      expect(source).not.toMatch(
        /export\s+(async\s+)?function\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/,
      );
      const exported = [
        ...source.matchAll(
          /export\s+const\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\s*=\s*([\w.]+)/g,
        ),
      ];
      expect(exported.length).toBeGreaterThan(0);
      for (const [, , from] of exported)
        expect(from).toMatch(/^mcpHandlers\.(mcp|metadata)$/);
      expect(source).not.toMatch(
        /NextResponse|new Response\(|Response\.json\(/,
      );
      expect(source).toMatch(/runtime\s*=\s*'nodejs'/);
    },
  );

  it('the handlers are built only through the wrapper', () => {
    const source = read('src/lib/mcp/request-handler.ts');
    expect(source).toContain('mcpRoute(handler, unhandled)');
    expect(source).toMatch(/const mcp = wrap\(/);
    expect(source).toMatch(/const metadata = wrap\(/);
  });
});

describe('framework config', () => {
  it('next.config sets the same values on /mcp and its metadata as the wrapper', () => {
    const source = read('next.config.ts');
    expect(source).toContain(
      `const MCP_CACHE_CONTROL = '${MCP_RESPONSE_HEADERS['Cache-Control']}'`,
    );
    expect(source).toContain(`const MCP_VARY = '${MCP_RESPONSE_HEADERS.Vary}'`);
    expect(source).toContain("source: '/mcp'");
    expect(source).toContain(
      "source: '/.well-known/oauth-protected-resource/mcp'",
    );
  });

  it('the hotfix #2691 class: /mcp is skipped by the middleware matcher AND by the static-rule prefixes', () => {
    // Tests that call the handler directly cannot catch a middleware 404; this keeps the two
    // lists in step. A real-host check is still needed (post-deploy curl checks).
    const middleware = read('src/middleware.ts');
    const matcher = middleware.slice(middleware.indexOf('export const config'));
    expect(matcher).toMatch(/\(\?!([^)]*\|)?mcp\|/);
    const nextConfig = read('next.config.ts');
    const prefixes = nextConfig.slice(
      nextConfig.indexOf('const MIDDLEWARE_SKIPPED_PREFIXES'),
      nextConfig.indexOf("].join('|')"),
    );
    expect(prefixes).toContain("'mcp'");
  });
});
