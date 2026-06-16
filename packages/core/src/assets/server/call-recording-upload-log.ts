import 'server-only';

import {
  CALL_RECORDING_UPLOAD_LOG_PREFIX,
  classifyCallRecordingUploadError,
} from '../call-recording-upload-errors';

export function logCallRecordingUploadFailure(
  event: string,
  error: unknown,
  context?: {
    fileName?: string;
    fileSizeBytes?: number;
    fileKey?: string;
    stage?: string;
  },
) {
  const failure = classifyCallRecordingUploadError(error, context);
  const level =
    failure.kind === 'storage_quota' || failure.kind === 'file_too_large'
      ? 'error'
      : 'warn';

  console[level](CALL_RECORDING_UPLOAD_LOG_PREFIX, {
    event,
    stage: context?.stage ?? 'uploadthing_route',
    ...failure.logPayload,
    ...(context?.fileKey ? { fileKey: context.fileKey } : {}),
    userMessage: failure.message,
  });
}
