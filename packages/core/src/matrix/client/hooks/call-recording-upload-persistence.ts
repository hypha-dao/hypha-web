/** CSH-RECORD-3 — survive soft SPA navigation within the same tab session. */

const SESSION_STORAGE_KEY = 'hypha-call-recording-upload-pending-v1';

export type PersistedPendingRecordingUploadMeta = {
  callSessionId: string;
  mimeType: string;
  spaceSlug: string;
  roomId: string;
  authToken: string;
  transcriptText?: string;
  startedAt: string;
  endedAt: string;
  launchContext?: {
    signalTitle?: string;
    signalSlug?: string;
    threadRootEventId?: string;
  };
};

export type PendingRecordingUploadPayload =
  PersistedPendingRecordingUploadMeta & {
    blob: Blob;
  };

const blobBySessionId = new Map<string, Blob>();

export function persistPendingRecordingUpload(
  pending: PendingRecordingUploadPayload,
): void {
  blobBySessionId.set(pending.callSessionId, pending.blob);
  if (typeof window === 'undefined') return;
  try {
    const { blob: _blob, ...meta } = pending;
    window.sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(meta));
  } catch {
    /* ignore quota / private mode */
  }
}

export function clearPersistedPendingRecordingUpload(): void {
  if (typeof window !== 'undefined') {
    try {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }
  blobBySessionId.clear();
}

export function restorePendingRecordingUpload(): PendingRecordingUploadPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw?.trim()) return null;
    const meta = JSON.parse(raw) as PersistedPendingRecordingUploadMeta;
    const blob = blobBySessionId.get(meta.callSessionId);
    if (!blob) {
      window.sessionStorage.removeItem(SESSION_STORAGE_KEY);
      return null;
    }
    return { ...meta, blob };
  } catch {
    return null;
  }
}
