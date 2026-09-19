import { describe, expect, it } from 'vitest';

import {
  formatImageUploadFailure,
  resolveImageUploadMime,
} from '../client/normalize-image-upload-file';

describe('resolveImageUploadMime', () => {
  it('maps image/jpg and .jpg to image/jpeg', () => {
    expect(
      resolveImageUploadMime({ name: 'logo.jpg', type: 'image/jpg' }),
    ).toBe('image/jpeg');
    expect(resolveImageUploadMime({ name: 'logo.jpg', type: '' })).toBe(
      'image/jpeg',
    );
  });

  it('infers png from the filename when the browser omits a type', () => {
    expect(
      resolveImageUploadMime({
        name: 'avatar.png',
        type: 'application/octet-stream',
      }),
    ).toBe('image/png');
  });

  it('keeps a real image/jpeg type', () => {
    expect(
      resolveImageUploadMime({ name: 'cropped.jpg', type: 'image/jpeg' }),
    ).toBe('image/jpeg');
  });
});

describe('formatImageUploadFailure', () => {
  it('includes the ingest body when UploadThing only says XHR failed 400', () => {
    const file = new File(['abc'], 'cropped.jpg', { type: 'image/jpeg' });
    const error = Object.assign(new Error('XHR failed 400'), {
      data: { error: 'Invalid file type' },
    });

    expect(formatImageUploadFailure(file, error).message).toContain(
      'Invalid file type',
    );
    expect(formatImageUploadFailure(file, error).message).toContain(
      'cropped.jpg',
    );
  });
});
