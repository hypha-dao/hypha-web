import 'server-only';
import { randomUUID } from 'node:crypto';
import { UTApi } from 'uploadthing/server';

import type { IntegrationDeveloperDeps } from '@hypha-platform/core/server';

const EXTENSION = { png: 'png', jpeg: 'jpg', webp: 'webp' } as const;

/**
 * Stores an already checked client logo in the platform's file storage
 * (UploadThing, the same service as profile and space images) and returns its
 * public URL. The file name is generated here, never taken from the upload.
 */
export const storeClientLogo: IntegrationDeveloperDeps['storeLogo'] = async ({
  slug,
  bytes,
  type,
  mime,
}) => {
  const token = process.env.UPLOADTHING_TOKEN?.trim();
  if (!token) throw new Error('File storage is not configured');

  const file = new File(
    [new Uint8Array(bytes)],
    `integration-client-${slug}-${randomUUID().slice(0, 8)}.${EXTENSION[type]}`,
    { type: mime },
  );
  const result = await new UTApi({ token }).uploadFiles(file);
  if (result.error || !result.data) {
    throw new Error('File storage rejected the logo');
  }
  const url = result.data.ufsUrl ?? result.data.url;
  if (!url || !url.startsWith('https://')) {
    throw new Error('File storage returned no public URL');
  }
  return url;
};
