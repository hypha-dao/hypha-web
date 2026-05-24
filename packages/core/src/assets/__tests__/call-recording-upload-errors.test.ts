import { describe, expect, it, vi } from 'vitest';

import { CALL_RECORDING_UPLOADTHING_MAX_FILE_SIZE } from '../call-recording-constants';
import {
  classifyCallRecordingUploadError,
  formatCallRecordingUploadFailureMessage,
} from '../call-recording-upload-errors';

describe('classifyCallRecordingUploadError', () => {
  it('classifies UploadThing file size limit errors', () => {
    const failure = classifyCallRecordingUploadError(
      { code: 'FILE_TOO_LARGE', message: 'File size exceeds maximum' },
      { fileName: 'session.webm', fileSizeBytes: 600 * 1024 * 1024 },
    );
    expect(failure.kind).toBe('file_too_large');
    expect(failure.message).toContain(CALL_RECORDING_UPLOADTHING_MAX_FILE_SIZE);
    expect(failure.logPayload.fileSizeBytes).toBe(600 * 1024 * 1024);
  });

  it('classifies UploadThing storage quota errors', () => {
    const failure = classifyCallRecordingUploadError(
      new Error(
        'Storage quota exceeded. Upgrade your plan to upload more files.',
      ),
    );
    expect(failure.kind).toBe('storage_quota');
    expect(failure.message).toContain('storage quota');
    expect(failure.message).toContain('UploadThing');
  });

  it('classifies unauthorized upload failures', () => {
    const failure = classifyCallRecordingUploadError({
      code: 'UNAUTHORIZED',
      message: 'Unauthorized',
    });
    expect(failure.kind).toBe('unauthorized');
  });

  it('falls back to unknown for unrecognized errors', () => {
    const failure = classifyCallRecordingUploadError(
      new Error('something odd'),
    );
    expect(failure.kind).toBe('unknown');
    expect(failure.rawMessage).toBe('something odd');
  });
});

describe('formatCallRecordingUploadFailureMessage', () => {
  it('mentions the configured max size for file_too_large', () => {
    expect(formatCallRecordingUploadFailureMessage('file_too_large')).toContain(
      '640MB',
    );
  });
});

describe('uploadCallRecordingBlob smoke', () => {
  it('returns mediaUri and storageKey when UploadThing succeeds', async () => {
    vi.doMock('uploadthing/client', () => ({
      genUploader: () => ({
        uploadFiles: vi.fn().mockResolvedValue([
          {
            ufsUrl: 'https://utfs.io/f/test-key',
            key: 'test-key',
            type: 'video/webm',
          },
        ]),
      }),
    }));

    const { uploadCallRecordingBlob } = await import(
      '../client/upload-call-recording'
    );
    const blob = new Blob(['fake-webm'], { type: 'video/webm' });
    const result = await uploadCallRecordingBlob({
      blob,
      fileName: 'session-1.webm',
      mimeType: 'video/webm',
      authorizationToken: 'test-token',
    });

    expect(result).toEqual({
      mediaUri: 'https://utfs.io/f/test-key',
      storageKey: 'test-key',
      mimeType: 'video/webm',
    });

    vi.doUnmock('uploadthing/client');
    vi.resetModules();
  });

  it('surfaces a friendly quota message when UploadThing rejects storage', async () => {
    vi.doMock('uploadthing/client', () => ({
      genUploader: () => ({
        uploadFiles: vi
          .fn()
          .mockRejectedValue(
            new Error('Storage quota exceeded. Upgrade your plan.'),
          ),
      }),
    }));

    const { uploadCallRecordingBlob } = await import(
      '../client/upload-call-recording'
    );
    const blob = new Blob(['fake-webm'], { type: 'video/webm' });

    await expect(
      uploadCallRecordingBlob({
        blob,
        fileName: 'session-1.webm',
        mimeType: 'video/webm',
        authorizationToken: 'test-token',
      }),
    ).rejects.toThrow(/storage quota/i);

    vi.doUnmock('uploadthing/client');
    vi.resetModules();
  });
});
