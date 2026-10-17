import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);

/**
 * `@uploadthing/shared` is not a direct core dependency; resolve it through
 * `uploadthing`, which is what `/api/uploadthing` uses to mint ingest URLs.
 */
async function loadGenerateSignedURL() {
  const uploadthingPkg = require.resolve('uploadthing/package.json');
  const sharedPkg = require.resolve('@uploadthing/shared/package.json', {
    paths: [uploadthingPkg],
  });
  const [shared, effect, Micro] = await Promise.all([
    import(require.resolve('@uploadthing/shared', { paths: [uploadthingPkg] })),
    import(require.resolve('effect', { paths: [sharedPkg] })),
    import(require.resolve('effect/Micro', { paths: [sharedPkg] })),
  ]);

  return {
    generateSignedURL: shared.generateSignedURL as (
      url: string,
      secretKey: unknown,
      opts: {
        ttlInSeconds?: number;
        data?: Record<string, string | number | boolean | null | undefined>;
      },
    ) => unknown,
    Redacted: effect.Redacted as { make: (value: string) => unknown },
    runPromise: Micro.runPromise as (effect: unknown) => Promise<string>,
  };
}

describe('UploadThing ingest signed URL encoding', () => {
  it('URLSearchParams encodes image/jpeg once; pre-encoding becomes %252F', () => {
    const once = new URL('https://sea1.ingest.uploadthing.com/key');
    once.searchParams.append('x-ut-file-type', 'image/jpeg');
    expect(once.href).toContain('x-ut-file-type=image%2Fjpeg');
    expect(once.href).not.toContain('image%252Fjpeg');
    expect(once.searchParams.get('x-ut-file-type')).toBe('image/jpeg');

    const twice = new URL('https://sea1.ingest.uploadthing.com/key');
    twice.searchParams.append(
      'x-ut-file-type',
      encodeURIComponent('image/jpeg'),
    );
    expect(twice.href).toContain('x-ut-file-type=image%252Fjpeg');
    expect(twice.searchParams.get('x-ut-file-type')).toBe('image%2Fjpeg');
  });

  it('generateSignedURL does not double-encode x-ut-file-type', async () => {
    const { generateSignedURL, Redacted, runPromise } =
      await loadGenerateSignedURL();

    const href = await runPromise(
      generateSignedURL(
        'https://sea1.ingest.uploadthing.com/abc123',
        Redacted.make('sk_test_dummy_secret_key_for_hmac'),
        {
          ttlInSeconds: 3600,
          data: {
            'x-ut-identifier': 'bovzk9ehhu',
            'x-ut-file-name': 'cropped.jpg',
            'x-ut-file-size': 126110,
            'x-ut-file-type': 'image/jpeg',
            'x-ut-slug': 'imageUploader',
            'x-ut-content-disposition': 'inline',
          },
        },
      ),
    );

    const parsed = new URL(href);
    expect(parsed.searchParams.get('x-ut-file-type')).toBe('image/jpeg');
    expect(href).toContain('x-ut-file-type=image%2Fjpeg');
    expect(href).not.toContain('image%252Fjpeg');
    expect(href).toContain('x-ut-identifier=bovzk9ehhu');
    expect(href).toMatch(/signature=hmac-sha256%3D/);
  });
});
