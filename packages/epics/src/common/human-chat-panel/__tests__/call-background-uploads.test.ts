import { describe, expect, it } from 'vitest';
import {
  CALL_BACKGROUND_UPLOAD_LIMIT,
  CALL_BACKGROUND_UPLOAD_MAX_BYTES,
  coverCropRect,
  uploadIdsBeyondLimit,
  validateCallBackgroundUploadFile,
} from '../call-background-uploads';

describe('validateCallBackgroundUploadFile', () => {
  it.each([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'IMAGE/JPEG',
  ])('accepts %s', (type) => {
    expect(validateCallBackgroundUploadFile({ type, size: 1000 })).toBeNull();
  });

  it.each(['image/gif', 'image/svg+xml', 'application/pdf', ''])(
    'rejects %p',
    (type) => {
      expect(validateCallBackgroundUploadFile({ type, size: 1000 })).toBe(
        'unsupported_type',
      );
    },
  );

  it('rejects files above the size limit', () => {
    expect(
      validateCallBackgroundUploadFile({
        type: 'image/jpeg',
        size: CALL_BACKGROUND_UPLOAD_MAX_BYTES + 1,
      }),
    ).toBe('too_large');
    expect(
      validateCallBackgroundUploadFile({
        type: 'image/jpeg',
        size: CALL_BACKGROUND_UPLOAD_MAX_BYTES,
      }),
    ).toBeNull();
  });
});

describe('coverCropRect', () => {
  it('crops the sides of a wider source, centred', () => {
    expect(coverCropRect(4000, 1000, 1920, 1080)).toEqual({
      sx: 1111,
      sy: 0,
      sw: 1778,
      sh: 1000,
    });
  });

  it('crops top and bottom of a taller (portrait) source, centred', () => {
    expect(coverCropRect(1080, 1920, 1920, 1080)).toEqual({
      sx: 0,
      sy: 656,
      sw: 1080,
      sh: 608,
    });
  });

  it('keeps an exact-aspect source whole', () => {
    expect(coverCropRect(3840, 2160, 1920, 1080)).toEqual({
      sx: 0,
      sy: 0,
      sw: 3840,
      sh: 2160,
    });
  });
});

describe('uploadIdsBeyondLimit', () => {
  it('drops the oldest beyond the limit', () => {
    const uploads = [1, 4, 2, 3].map((t) => ({ id: `u${t}`, createdAt: t }));
    expect(CALL_BACKGROUND_UPLOAD_LIMIT).toBe(3);
    expect(uploadIdsBeyondLimit(uploads)).toEqual(['u1']);
    expect(uploadIdsBeyondLimit(uploads, 1)).toEqual(['u3', 'u2', 'u1']);
    expect(uploadIdsBeyondLimit(uploads.slice(0, 2))).toEqual([]);
  });
});
