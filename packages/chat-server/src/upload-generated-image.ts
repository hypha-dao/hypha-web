import 'server-only';
import { UTApi } from 'uploadthing/server';

function parseDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } {
  const match = /^data:([^;]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!match?.[1] || !match[2]) {
    throw new Error('Invalid image data URL.');
  }
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes('png')) return 'png';
  if (mimeType.includes('webp')) return 'webp';
  if (mimeType.includes('jpeg') || mimeType.includes('jpg')) return 'jpg';
  return 'png';
}

function resolveUploadUrl(result: unknown): string | null {
  if (!result || typeof result !== 'object') return null;

  const envelope = result as {
    error?: unknown;
    data?: { ufsUrl?: unknown; url?: unknown };
    ufsUrl?: unknown;
    url?: unknown;
  };

  if (envelope.error) return null;

  const fileData = envelope.data ?? envelope;
  if (typeof fileData.ufsUrl === 'string' && fileData.ufsUrl.trim()) {
    return fileData.ufsUrl.trim();
  }
  if (typeof fileData.url === 'string' && fileData.url.trim()) {
    return fileData.url.trim();
  }
  return null;
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
