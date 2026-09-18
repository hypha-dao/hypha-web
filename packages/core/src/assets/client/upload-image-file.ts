'use client';

import { genUploader } from 'uploadthing/client';

import { getUploadThingClientFileUrl } from '../uploadthing-cdn';
import type { CoreFileRouter } from '../server';

const { uploadFiles } = genUploader<CoreFileRouter>();

const normalizeSvgMime = (file: File): File => {
  const isSvgByName = /\.svg$/i.test(file.name);
  const isFallbackMime =
    file.type === '' ||
    file.type === 'application/octet-stream' ||
    file.type === 'binary/octet-stream';

  if (isSvgByName && isFallbackMime) {
    return new File([file], file.name, {
      type: 'image/svg+xml',
      lastModified: file.lastModified,
    });
  }

  return file;
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
  if (file.size === 0) {
    throw new Error(
      `"${file.name}" is empty and cannot be uploaded. Crop or choose the image again.`,
    );
  }

  const result = await uploadFiles('imageUploader', {
    files: [normalizeSvgMime(file)],
    headers: { Authorization: `Bearer ${token}` },
  });

  const uploadedUrl = getUploadThingClientFileUrl(result);
  if (!uploadedUrl) {
    throw new Error(
      `Upload for "${file.name}" succeeded at ingest but returned no public URL.`,
    );
  }
  return uploadedUrl;
}
