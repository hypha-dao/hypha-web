import {
  CALL_RECORDING_MAX_FILE_SIZE_BYTES,
  CALL_RECORDING_MAX_FILE_SIZE_LABEL,
  CALL_RECORDING_UPLOADTHING_MAX_FILE_SIZE,
} from './call-recording-constants';

export type CallRecordingUploadFailureKind =
  | 'file_too_large'
  | 'storage_quota'
  | 'unauthorized'
  | 'unsupported_type'
  | 'network'
  | 'unknown';

export type CallRecordingUploadFailure = {
  kind: CallRecordingUploadFailureKind;
  message: string;
  rawMessage: string;
  code: string | null;
  logPayload: Record<string, unknown>;
};

function readErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message.trim();
  if (typeof error === 'string') return error.trim();
  if (typeof error === 'object' && error !== null) {
    const record = error as { message?: unknown; error?: unknown };
    if (typeof record.message === 'string') return record.message.trim();
    if (typeof record.error === 'string') return record.error.trim();
  }
  return String(error ?? 'Unknown upload error').trim();
}

function readErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null) return null;
  const record = error as { code?: unknown; data?: { code?: unknown } };
  if (typeof record.code === 'string' && record.code.trim()) {
    return record.code.trim();
  }
  if (typeof record.data?.code === 'string' && record.data.code.trim()) {
    return record.data.code.trim();
  }
  return null;
}

function includesAny(haystack: string, needles: string[]): boolean {
  const lower = haystack.toLowerCase();
  return needles.some((needle) => lower.includes(needle));
}

export function classifyCallRecordingUploadError(
  error: unknown,
  context?: { fileName?: string; fileSizeBytes?: number },
): CallRecordingUploadFailure {
  const rawMessage = readErrorMessage(error);
  const code = readErrorCode(error);
  const combined = [rawMessage, code ?? ''].filter(Boolean).join(' ');

  let kind: CallRecordingUploadFailureKind = 'unknown';
  if (
    code === 'UNAUTHORIZED' ||
    code === 'FORBIDDEN' ||
    includesAny(combined, ['unauthorized', 'forbidden', '401', '403'])
  ) {
    kind = 'unauthorized';
  } else if (
    includesAny(combined, [
      'storage quota',
      'storage limit',
      'quota exceeded',
      'out of storage',
      'insufficient storage',
      'storage full',
      'upgrade your plan',
      'exceeded your storage',
    ])
  ) {
    kind = 'storage_quota';
  } else if (
    code === 'FILE_TOO_LARGE' ||
    code === 'TOO_LARGE' ||
    includesAny(combined, [
      'file too large',
      'file size',
      'max file size',
      'payload too large',
      '413',
      'exceeds maximum',
    ])
  ) {
    kind = 'file_too_large';
  } else if (
    includesAny(combined, [
      'unsupported call recording',
      'unsupported type',
      'invalid file type',
      'bad request',
    ])
  ) {
    kind = 'unsupported_type';
  } else if (
    includesAny(combined, [
      'network',
      'fetch failed',
      'failed to fetch',
      'timeout',
      'timed out',
      'connection',
    ])
  ) {
    kind = 'network';
  }

  const logPayload: Record<string, unknown> = {
    kind,
    code,
    rawMessage,
    configuredMaxFileSize: CALL_RECORDING_UPLOADTHING_MAX_FILE_SIZE,
    configuredMaxFileSizeBytes: CALL_RECORDING_MAX_FILE_SIZE_BYTES,
    ...(context?.fileName ? { fileName: context.fileName } : {}),
    ...(context?.fileSizeBytes != null
      ? { fileSizeBytes: context.fileSizeBytes }
      : {}),
  };

  return {
    kind,
    message: formatCallRecordingUploadFailureMessage(kind),
    rawMessage,
    code,
    logPayload,
  };
}

export function formatCallRecordingUploadFailureMessage(
  kind: CallRecordingUploadFailureKind,
): string {
  switch (kind) {
    case 'file_too_large':
      return `Recording exceeds the ${CALL_RECORDING_MAX_FILE_SIZE_LABEL} upload limit. Try a shorter capture or transcript-only mode.`;
    case 'storage_quota':
      return 'Call recording storage quota exceeded on UploadThing. Upgrade the UploadThing plan or migrate recordings to dedicated object storage.';
    case 'unauthorized':
      return 'Not authorized to upload call recordings. Sign in again and retry.';
    case 'unsupported_type':
      return 'Recording format is not supported for upload.';
    case 'network':
      return 'Network error while uploading the recording. Check your connection and retry.';
    default:
      return 'Call recording upload failed. Check server logs for details.';
  }
}

export const CALL_RECORDING_UPLOAD_LOG_PREFIX =
  '[call-recording.upload]' as const;
