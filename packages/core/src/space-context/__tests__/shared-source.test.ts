import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  decodeSharedSourceBytes,
  extractSharedSourceUrls,
  filenameFromContentDisposition,
  htmlToText,
  isBlockedIpAddress,
  isSharedSourceUrl,
  parseSharedSourceUrl,
} from '../server/shared-source';
import {
  readSpaceContextSharedSource,
  type SharedSourceFetchOnce,
} from '../server/read-shared-source';

const encode = (value: string) => new TextEncoder().encode(value);
const mockFetchOnce = (
  impl: SharedSourceFetchOnce = async () => ({
    ok: false,
    error: 'unexpected fetch',
    code: 'fetch_failed',
  }),
) =>
  vi.fn<Parameters<SharedSourceFetchOnce>, ReturnType<SharedSourceFetchOnce>>(
    impl,
  );

describe('isBlockedIpAddress', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    'fc00::1',
    'ff02::1',
    '::ffff:127.0.0.1',
    '::ffff:7f00:1',
    '::ffff:10.0.0.1',
    '64:ff9b::a00:1',
    '2001:db8::1',
    '2002:a00:1::1',
    'not-an-ip',
  ])('blocks %s', (address) => {
    expect(isBlockedIpAddress(address)).toBe(true);
  });

  it.each([
    '8.8.8.8',
    '1.1.1.1',
    '172.32.0.1',
    '2606:4700:4700::1111',
    '::ffff:8.8.8.8',
  ])('allows %s', (address) => {
    expect(isBlockedIpAddress(address)).toBe(false);
  });
});

describe('parseSharedSourceUrl', () => {
  it('accepts public https links', () => {
    const parsed = parseSharedSourceUrl('https://hypha.earth/about');
    expect(parsed.ok).toBe(true);
  });

  it.each([
    ['http://hypha.earth', 'invalid_url'],
    ['ftp://hypha.earth/file', 'invalid_url'],
    ['https://user:pass@hypha.earth', 'invalid_url'],
    ['not a url', 'invalid_url'],
    ['https://localhost/', 'blocked_url'],
    ['https://app.localhost/', 'blocked_url'],
    ['https://printer.local/', 'blocked_url'],
    ['https://metadata/', 'blocked_url'],
    ['https://127.0.0.1/', 'blocked_url'],
    ['https://2130706433/', 'blocked_url'],
    ['https://0x7f000001/', 'blocked_url'],
    ['https://[::1]/', 'blocked_url'],
    ['https://169.254.169.254/latest/meta-data', 'blocked_url'],
    ['https://hypha.earth:8443/', 'blocked_url'],
  ])('rejects %s', (raw, code) => {
    const parsed = parseSharedSourceUrl(raw);
    expect(parsed.ok).toBe(false);
    if (!parsed.ok) expect(parsed.code).toBe(code);
  });
});

describe('extractSharedSourceUrls', () => {
  it('finds pasted links and Markdown document links', () => {
    const urls = extractSharedSourceUrls([
      'Read https://example.org/mission. Thanks!',
      'Shared document: [plan.pdf](https://abc.ufs.sh/f/key123)',
      'See https://en.wikipedia.org/wiki/Commons_(economics) too',
      'Ignore http://example.org/plain',
    ]);
    expect(urls).toEqual([
      'https://example.org/mission',
      'https://abc.ufs.sh/f/key123',
      'https://en.wikipedia.org/wiki/Commons_(economics)',
    ]);
  });

  it('matches shared URLs ignoring fragments and trailing slash normalization', () => {
    const shared = extractSharedSourceUrls(['https://example.org']);
    expect(isSharedSourceUrl('https://example.org/#top', shared)).toBe(true);
    expect(isSharedSourceUrl('https://evil.example/?q=1', shared)).toBe(false);
  });
});

describe('htmlToText', () => {
  it('keeps readable text and structure, drops scripts and chrome', () => {
    const { title, text } = htmlToText(`<!doctype html>
<html><head><title>Our Mission &amp; Vision</title>
<style>body{color:red}</style><script>alert("x")</script></head>
<body><nav><a href="/">Home</a></nav>
<h1>Mission</h1><p>Restore&nbsp;land &mdash; together.</p>
<ul><li>Soil</li><li>Water</li></ul><!-- hidden -->
<footer>Copyright</footer></body></html>`);
    expect(title).toBe('Our Mission & Vision');
    expect(text).toBe(
      '# Mission\n\nRestore land — together.\n\n- Soil\n- Water',
    );
  });

  it('stays linear on hostile markup', () => {
    const hostile = '<script'.repeat(50_000) + '<'.repeat(200_000);
    const started = Date.now();
    htmlToText(hostile);
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('does not reassemble tags from nested fragments', () => {
    const { text } = htmlToText('<p>a <scr<b>ipt>alert(1)</p> 1 &lt; 2');
    expect(text).not.toContain('<script');
    expect(text).toContain('1 < 2');
  });
});

describe('decodeSharedSourceBytes', () => {
  it('returns Markdown and plain text as text', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: encode('# Plan\n\nShip it.'),
      contentType: 'application/octet-stream',
      filename: 'plan.md',
    });
    expect(result).toMatchObject({
      ok: true,
      mode: 'text',
      mime: 'text/plain',
      text: '# Plan\n\nShip it.',
    });
  });

  it('sniffs untyped UTF-8 as text', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: encode('notes without a name'),
      contentType: null,
      filename: 'key123',
    });
    expect(result).toMatchObject({ ok: true, mode: 'text' });
  });

  it('keeps images binary for multimodal models', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
      contentType: 'image/png',
      filename: 'logo.png',
    });
    expect(result).toMatchObject({
      ok: true,
      mode: 'binary',
      data_base64: 'iVBORw==',
    });
  });

  it('rejects unsupported binaries', async () => {
    const result = await decodeSharedSourceBytes({
      bytes: new Uint8Array([0, 1, 2, 3]),
      contentType: 'application/zip',
      filename: 'archive.zip',
    });
    expect(result).toMatchObject({ ok: false, code: 'unsupported_type' });
  });
});

describe('filenameFromContentDisposition', () => {
  it('reads plain and RFC 5987 filenames', () => {
    expect(
      filenameFromContentDisposition('attachment; filename="notes.md"'),
    ).toBe('notes.md');
    expect(
      filenameFromContentDisposition(
        "attachment; filename*=UTF-8''pl%C3%A1n.pdf",
      ),
    ).toBe('plán.pdf');
  });
});

describe('readSpaceContextSharedSource', () => {
  const html = (body: string) => ({
    kind: 'body' as const,
    bytes: encode(body),
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });

  it('reads a shared HTML page as text', async () => {
    const fetchOnce = mockFetchOnce(async () =>
      html('<title>About</title><p>We grow food.</p>'),
    );
    const result = await readSpaceContextSharedSource(
      {
        url: 'https://example.org/about',
        sharedUrls: ['https://example.org/about'],
      },
      { fetchOnce },
    );
    expect(result).toMatchObject({
      ok: true,
      mode: 'text',
      title: 'About',
      text: 'We grow food.',
      final_url: 'https://example.org/about',
    });
  });

  it('refuses links nobody shared', async () => {
    const fetchOnce = mockFetchOnce();
    const result = await readSpaceContextSharedSource(
      { url: 'https://evil.example/', sharedUrls: ['https://example.org/'] },
      { fetchOnce },
    );
    expect(result).toMatchObject({ ok: false, code: 'not_shared' });
    expect(fetchOnce).not.toHaveBeenCalled();
  });

  it('re-validates redirects and blocks internal targets', async () => {
    const fetchOnce = mockFetchOnce(async () => ({
      kind: 'redirect' as const,
      location: 'https://169.254.169.254/latest/meta-data',
    }));
    const result = await readSpaceContextSharedSource(
      { url: 'https://example.org/go' },
      { fetchOnce },
    );
    expect(result).toMatchObject({ ok: false, code: 'blocked_url' });
    expect(fetchOnce).toHaveBeenCalledTimes(1);
  });

  it('follows a bounded number of public redirects', async () => {
    const fetchOnce = mockFetchOnce(async () => ({
      kind: 'redirect' as const,
      location: '/again',
    }));
    const result = await readSpaceContextSharedSource(
      { url: 'https://example.org/loop' },
      { fetchOnce },
    );
    expect(result).toMatchObject({ ok: false, code: 'fetch_failed' });
    expect(fetchOnce).toHaveBeenCalledTimes(4);
  });

  it('caps max bytes at the org-memory limit', async () => {
    const fetchOnce = mockFetchOnce(async () => html('<p>x</p>'));
    await readSpaceContextSharedSource(
      { url: 'https://example.org/', maxBytes: 50 * 1024 * 1024 },
      { fetchOnce },
    );
    expect(fetchOnce.mock.calls[0]?.[1]).toBe(4 * 1024 * 1024);
  });
});
