import { describe, expect, it } from 'vitest';

import {
  isUploadThingCdnHostname,
  isUploadThingCdnUrl,
} from '../uploadthing-cdn';

describe('isUploadThingCdnHostname', () => {
  it('accepts legacy utfs.io hosts', () => {
    expect(isUploadThingCdnHostname('utfs.io')).toBe(true);
    expect(isUploadThingCdnHostname('app.utfs.io')).toBe(true);
  });

  it('accepts UploadThing v7 app-scoped ufs.sh hosts', () => {
    expect(isUploadThingCdnHostname('ufs.sh')).toBe(true);
    expect(isUploadThingCdnHostname('abc123.ufs.sh')).toBe(true);
  });

  it('rejects unrelated hosts', () => {
    expect(isUploadThingCdnHostname('example.com')).toBe(false);
    expect(isUploadThingCdnHostname('ufs.sh.evil.com')).toBe(false);
    expect(isUploadThingCdnHostname('notufs.sh')).toBe(false);
  });
});

describe('isUploadThingCdnUrl', () => {
  it('accepts v7 banner URLs that the header used to treat as optimized', () => {
    expect(isUploadThingCdnUrl('https://abc123.ufs.sh/f/banner-key')).toBe(
      true,
    );
  });

  it('accepts legacy utfs.io URLs', () => {
    expect(isUploadThingCdnUrl('https://utfs.io/f/old-key')).toBe(true);
  });

  it('rejects local placeholders and other remotes', () => {
    expect(isUploadThingCdnUrl('/placeholder/space-lead-image.webp')).toBe(
      false,
    );
    expect(isUploadThingCdnUrl('https://github.githubassets.com/img.png')).toBe(
      false,
    );
  });
});
