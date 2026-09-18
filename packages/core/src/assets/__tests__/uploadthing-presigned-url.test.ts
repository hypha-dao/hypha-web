import { createHmac } from 'node:crypto';
import { describe, expect, it } from 'vitest';

import {
  isDoubleEncodedUploadThingUrl,
  probeBundledGenerateSignedURL,
  readUploadThingApiKey,
  rewriteDoubleEncodedUploadThingUrl,
} from '../server/uploadthing-presigned-url';

const API_KEY = 'sk_test_rewrite_secret';

function sign(url: string): string {
  return `hmac-sha256=${createHmac('sha256', API_KEY)
    .update(url)
    .digest('hex')}`;
}

describe('rewriteDoubleEncodedUploadThingUrl', () => {
  it('detects the Anton ingest 400 query shape', () => {
    const href =
      'https://sea1.ingest.uploadthing.com/abc?expires=1&x-ut-file-type=image%252Fjpeg&signature=hmac-sha256%3Ddead';
    expect(isDoubleEncodedUploadThingUrl(href)).toBe(true);
  });

  it('leaves a once-encoded MIME type alone', () => {
    const href =
      'https://sea1.ingest.uploadthing.com/abc?expires=1&x-ut-file-type=image%2Fjpeg&signature=hmac-sha256%3Ddead';
    expect(isDoubleEncodedUploadThingUrl(href)).toBe(false);
    expect(rewriteDoubleEncodedUploadThingUrl(href, API_KEY)).toBe(href);
  });

  it('rebuilds and re-signs a double-encoded ingest URL', () => {
    const broken =
      'https://sea1.ingest.uploadthing.com/abc?expires=1789718439837&x-ut-identifier=bovzk9ehhu&x-ut-file-name=cropped.jpg&x-ut-file-size=126110&x-ut-file-type=image%252Fjpeg&x-ut-slug=imageUploader&x-ut-content-disposition=inline&signature=hmac-sha256%3Dold';

    const fixed = rewriteDoubleEncodedUploadThingUrl(broken, API_KEY);
    const parsed = new URL(fixed);

    expect(fixed).toContain('x-ut-file-type=image%2Fjpeg');
    expect(fixed).not.toContain('image%252Fjpeg');
    expect(parsed.searchParams.get('x-ut-file-type')).toBe('image/jpeg');
    expect(parsed.searchParams.get('x-ut-identifier')).toBe('bovzk9ehhu');

    const unsigned = new URL(fixed);
    unsigned.searchParams.delete('signature');
    expect(parsed.searchParams.get('signature')).toBe(
      sign(unsigned.toString()),
    );
  });
});

describe('readUploadThingApiKey', () => {
  it('reads sk_ keys from the UploadThing token payload', () => {
    const token = Buffer.from(
      JSON.stringify({ apiKey: 'sk_live_abc', appId: 'bovzk9ehhu' }),
    ).toString('base64');
    expect(readUploadThingApiKey(token)).toBe('sk_live_abc');
    expect(readUploadThingApiKey('not-base64')).toBeUndefined();
  });
});

describe('probeBundledGenerateSignedURL', () => {
  it('reports the installed SDK as patched', () => {
    expect(probeBundledGenerateSignedURL()).toEqual({
      patched: true,
      includesEncodeURIComponent: false,
    });
  });
});
