// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  clearPersistedPendingRecordingUpload,
  persistPendingRecordingUpload,
  restorePendingRecordingUpload,
} from '../call-recording-upload-persistence';

describe('call-recording-upload-persistence (CSH-RECORD-3)', () => {
  beforeEach(() => {
    sessionStorage.clear();
    clearPersistedPendingRecordingUpload();
  });

  afterEach(() => {
    sessionStorage.clear();
    clearPersistedPendingRecordingUpload();
  });

  it('persists metadata and restores blob within the same session', () => {
    const blob = new Blob(['recording'], { type: 'video/webm' });
    persistPendingRecordingUpload({
      blob,
      callSessionId: 'session-1',
      mimeType: 'video/webm',
      spaceSlug: 'demo-space',
      roomId: '!room:matrix.org',
      authToken: 'token',
      startedAt: '2026-06-02T00:00:00.000Z',
      endedAt: '2026-06-02T00:05:00.000Z',
    });

    const restored = restorePendingRecordingUpload();
    expect(restored?.callSessionId).toBe('session-1');
    expect(restored?.blob).toBe(blob);
  });

  it('clears persisted metadata after success', () => {
    persistPendingRecordingUpload({
      blob: new Blob(['x']),
      callSessionId: 'session-2',
      mimeType: 'video/webm',
      spaceSlug: 'demo-space',
      roomId: '!room:matrix.org',
      authToken: 'token',
      startedAt: '2026-06-02T00:00:00.000Z',
      endedAt: '2026-06-02T00:05:00.000Z',
    });
    clearPersistedPendingRecordingUpload();
    expect(restorePendingRecordingUpload()).toBeNull();
    expect(
      sessionStorage.getItem('hypha-call-recording-upload-pending-v1'),
    ).toBe(null);
  });
});
