import 'server-only';

import { isTrustedCallRecordingMediaUrl } from '../call-recording-constants';

export {
  CALL_RECORDING_MAX_FILE_SIZE_BYTES,
  CALL_RECORDING_TARGET_DURATION_SECONDS,
  CALL_RECORDING_UPLOADTHING_MAX_FILE_SIZE,
  CALL_RECORDING_TRUSTED_STORAGE_HOST_SUFFIXES,
  computeCallRecordingDurationSeconds,
  isTrustedCallRecordingMediaUrl,
  objectStorageUriMatchesKey,
} from '../call-recording-constants';

export async function verifyCallRecordingMediaAccessible(
  url: string,
  timeoutMs = 15_000,
): Promise<boolean> {
  if (!isTrustedCallRecordingMediaUrl(url)) return false;
  try {
    const response = await fetch(url.trim(), {
      method: 'HEAD',
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (response.ok) return true;
    if (response.status === 405 || response.status === 501) {
      const getResponse = await fetch(url.trim(), {
        method: 'GET',
        headers: { Range: 'bytes=0-0' },
        redirect: 'follow',
        signal: AbortSignal.timeout(timeoutMs),
      });
      return getResponse.ok || getResponse.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}
