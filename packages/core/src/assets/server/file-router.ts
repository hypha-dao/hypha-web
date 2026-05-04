import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { NextRequest } from 'next/server';

import { getDb } from '@hypha-platform/core/server';
import { verifyAuth } from '@hypha-platform/core/server';
import { ECOSYSTEM_LOGO_IMAGE_ACCEPT } from '../constant';

const f = createUploadthing();

const getAuthenticatedUser = async (req: NextRequest) => {
  const authToken = req.headers.get('Authorization')?.split(' ')[1];
  const isValidAuthToken = await verifyAuth({ db: getDb({ authToken }) });
  return isValidAuthToken;
};

const SVG_FALLBACK_MIME_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
]);

export const fileRouter: FileRouter = {
  attachmentUploader: f({
    pdf: {
      maxFileSize: '4MB',
      maxFileCount: 3,
      contentDisposition: 'attachment',
    },
    image: {
      maxFileSize: '4MB',
      maxFileCount: 3,
      contentDisposition: 'attachment',
    },
  })
    .middleware(async ({ req }) => {
      const isValidAuthToken = await getAuthenticatedUser(req);

      if (!isValidAuthToken) {
        throw new UploadThingError('Unauthorized');
      }

      return { isAuthenticated: true };
    })
    .onUploadError((error) => console.error('Attachment upload failed:', error))
    .onUploadComplete(({ file }) =>
      console.debug(`Attachment "${file.key}" was successfully uploaded`),
    ),
  imageUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
    blob: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req, files }) => {
      const isValidAuthToken = await getAuthenticatedUser(req);

      if (!isValidAuthToken) {
        throw new UploadThingError('Unauthorized');
      }

      for (const file of files) {
        const fileType = typeof file.type === 'string' ? file.type : '';
        const isSvgByName =
          typeof file.name === 'string' && /\.svg$/i.test(file.name);
        const isAcceptedSvgFallbackMime =
          isSvgByName && SVG_FALLBACK_MIME_TYPES.has(fileType);

        if (
          (!fileType || !ECOSYSTEM_LOGO_IMAGE_ACCEPT.includes(fileType)) &&
          !isAcceptedSvgFallbackMime
        ) {
          throw new UploadThingError('Unsupported image type');
        }
      }

      return { isAuthenticated: true };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.debug('ourFileRouter.onUploadComplete', { metadata, file });
      return;
    }),
} satisfies FileRouter;

export type CoreFileRouter = typeof fileRouter;
