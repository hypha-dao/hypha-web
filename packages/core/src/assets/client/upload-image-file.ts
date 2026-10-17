'use client';

import { genUploader } from 'uploadthing/client';

import { getUploadThingClientFileUrl } from '../uploadthing-cdn';
import type { CoreFileRouter } from '../server';
import {
  formatImageUploadFailure,
  normalizeImageUploadFile,
} from './normalize-image-upload-file';

const { uploadFiles } = genUploader<CoreFileRouter>();

const isTransientIngestFailure = (error: unknown): boolean => {
  const message = error instanceof Error ? error.message : String(error);
  return /XHR failed 400/i.test(message);
};

/**
 * Upload one image via UploadThing without `useUploadThing` hook state.
 * Concurrent `startUpload` calls on the same hook can return `undefined`
 * after a successful ingest PUT (the hook swallows errors and shares progress).
 */
export async function uploadImageFile(
  file: File,
  authorizationToken?: string,
): Promise<string> {
  const token = authorizationToken?.trim();
  if (!token) {
    throw new Error('Authentication is required to upload images.');
  }

  const normalized = await normalizeImageUploadFile(file);

  const uploadOnce = async () => {
    const result = await uploadFiles('imageUploader', {
      files: [normalized],
      headers: { Authorization: `Bearer ${token}` },
    });

    const uploadedUrl = getUploadThingClientFileUrl(result);
    if (!uploadedUrl) {
      throw new Error(
        `Upload for "${normalized.name}" succeeded at ingest but returned no public URL.`,
      );
    }
    return uploadedUrl;
  };

  try {
    return await uploadOnce();
  } catch (error) {
    if (isTransientIngestFailure(error)) {
      try {
        return await uploadOnce();
      } catch (retryError) {
        throw formatImageUploadFailure(normalized, retryError);
      }
    }
    throw formatImageUploadFailure(normalized, error);
  }
}
