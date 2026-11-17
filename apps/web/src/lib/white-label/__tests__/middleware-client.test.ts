import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

import { WHITE_LABEL_CONFIG_ENV } from '..';
import { middleware } from '../../../middleware';

// next-intl cannot load under vitest; the white-label paths never call it.
vi.mock('@hypha-platform/i18n', () => ({
  middleware: () => new Response(null),
  routing: { locales: ['en', 'pt'], defaultLocale: 'en' },
}));

const CONFIG = JSON.stringify([
  {
    id: 'client-a',
    detailView: 'full-app',
    spaces: [
      { slug: 'shared', framingOrigins: ['https://a.example'] },
      { slug: 'only-a', framingOrigins: ['https://a.example'] },
    ],
  },
  {
    id: 'client-b',
    spaces: [{ slug: 'shared', framingOrigins: ['https://b.example'] }],
  },
]);

const get = (path: string) =>
  middleware(new NextRequest(new URL(path, 'https://app.example')));

const frameAncestors = (response: Response): string | undefined =>
  response.headers
    .get('content-security-policy')
    ?.split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith('frame-ancestors'));

const forwarded = (response: Response, name: string): string | null =>
  response.headers.get(`x-middleware-request-${name}`);

describe('middleware: client selection in the frame', () => {
  const saved = process.env[WHITE_LABEL_CONFIG_ENV];
  beforeEach(() => {
    process.env[WHITE_LABEL_CONFIG_ENV] = CONFIG;
  });
  afterEach(() => {
    if (saved === undefined) delete process.env[WHITE_LABEL_CONFIG_ENV];
    else process.env[WHITE_LABEL_CONFIG_ENV] = saved;
  });

  it('a single approving client: used without the parameter, its origins only', () => {
    const response = get('/embed/only-a/en/agreements');
    expect(frameAncestors(response)).toBe('frame-ancestors https://a.example');
    expect(forwarded(response, 'x-hypha-wl-client')).toBe('client-a');
    expect(forwarded(response, 'x-hypha-wl-detail-view')).toBe('full-app');
  });

  it('a named client narrows frame-ancestors to its own origins', () => {
    const a = get('/embed/shared/en/agreements?client=client-a');
    expect(frameAncestors(a)).toBe('frame-ancestors https://a.example');
    expect(forwarded(a, 'x-hypha-wl-client')).toBe('client-a');
    const b = get('/embed/shared/en/agreements?client=client-b');
    expect(frameAncestors(b)).toBe('frame-ancestors https://b.example');
    expect(forwarded(b, 'x-hypha-wl-detail-view')).toBe('embedded');
  });

  it('several approving and none named: defaults, the union of origins, no client header', () => {
    const response = get('/embed/shared/en/agreements');
    expect(frameAncestors(response)).toBe(
      'frame-ancestors https://a.example https://b.example',
    );
    expect(forwarded(response, 'x-hypha-wl-client')).toBeNull();
    expect(forwarded(response, 'x-hypha-wl-detail-view')).toBe('embedded');
  });

  it('a client that does not approve the Space is not served', () => {
    const response = get('/embed/only-a/en/agreements?client=client-b');
    expect(frameAncestors(response)).not.toContain('b.example');
    expect(forwarded(response, 'x-hypha-wl-client')).toBeNull();
  });

  it('a visitor-sent client header is dropped', () => {
    const request = new NextRequest(
      new URL('/embed/shared/en/agreements', 'https://app.example'),
      { headers: { 'x-hypha-wl-client': 'client-a' } },
    );
    expect(forwarded(middleware(request), 'x-hypha-wl-client')).toBeNull();
  });
});
