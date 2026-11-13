import { describe, expect, it } from 'vitest';

import {
  cspMediaSrcSources,
  isUrlAllowedByCspSources,
  matrixHomeserverOrigin,
  parseCspImageHosts,
} from '../csp-media-src';

const SELF = 'https://app.hypha.earth';
const SOURCES = cspMediaSrcSources({
  imageHosts: parseCspImageHosts('images.example.org, cdn.example.net'),
  matrixOrigin: matrixHomeserverOrigin('matrix.hypha.earth'),
});

describe('cspMediaSrcSources', () => {
  it('lists the media-src sources the middleware sends', () => {
    expect(SOURCES.join(' ')).toBe(
      "'self' data: blob: https://*.ufs.sh https://utfs.io https://*.utfs.io https://matrix.hypha.earth https://images.example.org https://cdn.example.net",
    );
  });

  it('leaves out an unset Matrix homeserver', () => {
    expect(
      cspMediaSrcSources({ imageHosts: [], matrixOrigin: '' }).join(' '),
    ).toBe(
      "'self' data: blob: https://*.ufs.sh https://utfs.io https://*.utfs.io",
    );
  });
});

describe('isUrlAllowedByCspSources', () => {
  it('allows the app origin, UploadThing and configured hosts', () => {
    for (const url of [
      `${SELF}/clips/intro.mp4`,
      'https://abc123.ufs.sh/f/intro.mp4',
      'https://utfs.io/f/intro.mp4',
      'https://matrix.hypha.earth/_matrix/media/v3/download/x/y',
      'https://images.example.org/intro.webm',
    ]) {
      expect(isUrlAllowedByCspSources(url, SOURCES, SELF)).toBe(true);
    }
  });

  it('blocks direct video files from any other host', () => {
    for (const url of [
      'https://example.com/intro.mp4',
      'https://ufs.sh/intro.mp4',
      'https://evil-utfs.io/intro.mp4',
      'http://images.example.org.attacker.com/intro.mp4',
      'https://app.hypha.earth.example.com/intro.mp4',
    ]) {
      expect(isUrlAllowedByCspSources(url, SOURCES, SELF)).toBe(false);
    }
  });

  it("does not treat 'self' as allowed without a known origin", () => {
    expect(
      isUrlAllowedByCspSources(`${SELF}/intro.mp4`, ["'self'"], null),
    ).toBe(false);
  });

  it('honours ports and paths on host sources', () => {
    expect(
      isUrlAllowedByCspSources(
        'https://videos.example.com:8443/a.mp4',
        ['https://videos.example.com'],
        SELF,
      ),
    ).toBe(false);
    expect(
      isUrlAllowedByCspSources(
        'https://videos.example.com/public/a.mp4',
        ['https://videos.example.com/public/'],
        SELF,
      ),
    ).toBe(true);
    expect(
      isUrlAllowedByCspSources(
        'https://videos.example.com/private/a.mp4',
        ['https://videos.example.com/public/'],
        SELF,
      ),
    ).toBe(false);
  });

  it('rejects malformed URLs', () => {
    expect(isUrlAllowedByCspSources('not a url', SOURCES, SELF)).toBe(false);
  });
});
