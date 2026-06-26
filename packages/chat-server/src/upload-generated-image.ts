import 'server-only';
import { UTApi } from 'uploadthing/server';

import { resolveUploadUrl } from './upload-generated-image-url';

const ALLOWED_IMAGE_MIME_TYPES = new Set([
  'image/png',
  'image/webp',
  'image/jpeg',
]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;

function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) {
    throw new Error('Invalid image data URL.');
  }

  const mimeType = match[1].toLowerCase();
  if (!ALLOWED_IMAGE_MIME_TYPES.has(mimeType)) {
    throw new Error(`Unsupported image MIME type: ${mimeType}`);
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.byteLength > MAX_IMAGE_BYTES) {
    throw new Error('Generated image exceeds the maximum allowed size.');
  }

  return {
    mimeType,
    buffer,
  };
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return 'png';
}

export async function uploadGeneratedImageDataUrl(
  dataUrl: string,
  filenameStem: string,
): Promise<string> {
  const token = process.env.UPLOADTHING_TOKEN?.trim();
  if (!token) {
    throw new Error('UPLOADTHING_TOKEN is missing.');
  }

  const { buffer, mimeType } = parseDataUrl(dataUrl);
  const extension = extensionForMime(mimeType);
  const file = new File([buffer], `${filenameStem}.${extension}`, {
    type: mimeType,
  });

  const utapi = new UTApi({ token });
  const uploadResult = await utapi.uploadFiles(file);
  if (
    uploadResult &&
    typeof uploadResult === 'object' &&
    'error' in uploadResult &&
    uploadResult.error
  ) {
    throw new Error(
      uploadResult.error instanceof Error
        ? uploadResult.error.message
        : 'Upload failed.',
    );
  }
  const uploadedUrl = resolveUploadUrl(uploadResult);
  if (!uploadedUrl) {
    throw new Error('Upload succeeded but no public URL was returned.');
  }
  return uploadedUrl;
}
