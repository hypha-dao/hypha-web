import { describe, expect, it } from 'vitest';

import { resolveUploadUrl } from '../upload-generated-image-url';

describe('resolveUploadUrl', () => {
  it('prefers envelope.data over the top-level result', () => {
    const url = resolveUploadUrl({
      data: { url: 'https://cdn.example.com/from-data.png' },
      url: 'https://cdn.example.com/from-top.png',
    });
    expect(url).toBe('https://cdn.example.com/from-data.png');
  });

  it('resolves supported field aliases in priority order', () => {
    expect(
      resolveUploadUrl({ data: { ufsUrl: 'https://cdn.example.com/a.png' } }),
    ).toBe('https://cdn.example.com/a.png');
    expect(
      resolveUploadUrl({ data: { fileUrl: 'https://cdn.example.com/b.png' } }),
    ).toBe('https://cdn.example.com/b.png');
    expect(
      resolveUploadUrl({ data: { appUrl: 'https://cdn.example.com/c.png' } }),
    ).toBe('https://cdn.example.com/c.png');
  });

  it('rejects http URLs and envelope errors', () => {
    expect(
      resolveUploadUrl({
        data: { url: 'http://cdn.example.com/insecure.png' },
      }),
    ).toBeNull();
    expect(
      resolveUploadUrl({
        error: { message: 'upload failed' },
        data: { url: 'https://cdn.example.com/ignored.png' },
      }),
    ).toBeNull();
  });

  it('returns null when no alias resolves', () => {
    expect(resolveUploadUrl({ data: { id: 'file_123' } })).toBeNull();
    expect(resolveUploadUrl(null)).toBeNull();
  });
});
