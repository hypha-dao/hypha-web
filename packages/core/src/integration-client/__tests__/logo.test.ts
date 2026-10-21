import { describe, expect, it } from 'vitest';

import {
  CLIENT_LOGO_MAX_BYTES,
  inspectClientLogo,
  visibleClientLogoUrl,
} from '../logo';
import { jpeg, png, webpLossless } from './logo-fixtures';

describe('inspectClientLogo', () => {
  it('accepts PNG, JPEG and WebP and reads the real size', () => {
    expect(inspectClientLogo(png(128, 128))).toMatchObject({
      ok: true,
      type: 'png',
      mime: 'image/png',
      width: 128,
      height: 128,
    });
    expect(inspectClientLogo(jpeg(200, 150))).toMatchObject({
      ok: true,
      type: 'jpeg',
      width: 200,
      height: 150,
    });
    expect(inspectClientLogo(webpLossless(256, 300))).toMatchObject({
      ok: true,
      type: 'webp',
      width: 256,
      height: 300,
    });
  });

  it('judges the bytes, not a name or a declared type', () => {
    const svg = new TextEncoder().encode(
      '<svg xmlns="http://www.w3.org/2000/svg"><script>1</script></svg>',
    );
    expect(inspectClientLogo(svg)).toEqual({
      ok: false,
      reason: 'unsupported_type',
    });
    const gif = new TextEncoder().encode('GIF89a......');
    expect(inspectClientLogo(gif)).toEqual({
      ok: false,
      reason: 'unsupported_type',
    });
    const html = new TextEncoder().encode('<html><body>hi</body></html>');
    expect(inspectClientLogo(html).ok).toBe(false);
  });

  it('refuses an empty file and one over the size cap', () => {
    expect(inspectClientLogo(new Uint8Array())).toEqual({
      ok: false,
      reason: 'empty',
    });
    expect(inspectClientLogo(png(128, 128, CLIENT_LOGO_MAX_BYTES))).toEqual({
      ok: false,
      reason: 'too_large',
    });
    expect(
      inspectClientLogo(png(128, 128, CLIENT_LOGO_MAX_BYTES - 33)).ok,
    ).toBe(true);
  });

  it('refuses a truncated header', () => {
    expect(inspectClientLogo(png(128, 128).slice(0, 16))).toEqual({
      ok: false,
      reason: 'unreadable',
    });
    expect(inspectClientLogo(jpeg(128, 128).slice(0, 8))).toEqual({
      ok: false,
      reason: 'unreadable',
    });
  });

  it('refuses images that are not roughly square or are too small or large', () => {
    for (const bytes of [
      png(400, 100),
      png(100, 400),
      png(16, 16),
      png(5000, 5000),
    ]) {
      expect(inspectClientLogo(bytes)).toEqual({
        ok: false,
        reason: 'bad_dimensions',
      });
    }
  });
});

describe('visibleClientLogoUrl', () => {
  const url = 'https://files.example/logo.png';

  it('shows the logo only for an approved client', () => {
    expect(visibleClientLogoUrl({ status: 'approved', logoUrl: url })).toBe(
      url,
    );
    expect(
      visibleClientLogoUrl({ status: 'pending', logoUrl: url }),
    ).toBeNull();
    expect(
      visibleClientLogoUrl({ status: 'revoked', logoUrl: url }),
    ).toBeNull();
  });

  it('shows nothing without a logo or for a non-https address', () => {
    expect(
      visibleClientLogoUrl({ status: 'approved', logoUrl: null }),
    ).toBeNull();
    expect(
      visibleClientLogoUrl({
        status: 'approved',
        logoUrl: 'http://files.example/logo.png',
      }),
    ).toBeNull();
  });
});
