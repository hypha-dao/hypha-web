'use client';

import { genUploader } from 'uploadthing/client';

import {
  CALL_RECORDING_UPLOAD_LOG_PREFIX,
  classifyCallRecordingUploadError,
} from '../call-recording-upload-errors';
import type { CoreFileRouter } from '../server';

const { uploadFiles } = genUploader<CoreFileRouter>();

export type CallRecordingUploadResult = {
  mediaUri: string;
  storageKey: string;
  mimeType: string;
};

export async function uploadCallRecordingBlob({
  blob,
  fileName,
  mimeType,
  authorizationToken,
}: {
  blob: Blob;
  fileName: string;
  mimeType: string;
  authorizationToken: string;
}): Promise<CallRecordingUploadResult> {
  const file = new File([blob], fileName, {
    type: mimeType.trim() || blob.type.trim() || 'video/webm',
  });

  try {
    const [uploaded] = await uploadFiles('callRecordingUploader', {
      files: [file],
      headers: { Authorization: `Bearer ${authorizationToken}` },
    });
    if (!uploaded?.ufsUrl?.trim() || !uploaded.key?.trim()) {
      throw new Error('Call recording upload did not return a storage URL');
    }
    return {
      mediaUri: uploaded.ufsUrl.trim(),
      storageKey: uploaded.key.trim(),
      mimeType: uploaded.type?.trim() || file.type,
    };
  } catch (error) {
    const failure = classifyCallRecordingUploadError(error, {
      fileName: file.name,
      fileSizeBytes: file.size,
    });
    console.error(CALL_RECORDING_UPLOAD_LOG_PREFIX, {
      event: 'client_upload_failed',
      stage: 'uploadCallRecordingBlob',
      ...failure.logPayload,
      userMessage: failure.message,
    });
    throw new Error(failure.message, { cause: error });
  }
}
