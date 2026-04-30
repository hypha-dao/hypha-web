import type { FastifyBaseLogger, FastifyRequest } from 'fastify';
import { createUploadthing, type FileRouter } from 'uploadthing/fastify';
import { UploadThingError } from 'uploadthing/server';

const ECOSYSTEM_LOGO_IMAGE_ACCEPT = [
  'image/jpg',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/svg+xml',
];

export interface uploadRouterParams {
  /**
   * @summary Part of the middleware that checks if the request is allowed
   */
  isAllowed: (req: FastifyRequest) => Promise<boolean>;
  /**
   * @summary Uses info to log uploaded files
   */
  logger: FastifyBaseLogger;
  /**
   * @default 3
   */
  maxAttachmentsCount?: number;
}

export function newUploadRouter({
  isAllowed,
  logger,
  maxAttachmentsCount = 3,
}: uploadRouterParams) {
  const f = createUploadthing();

  return {
    attachmentUploader: f({
      pdf: {
        maxFileSize: '4MB',
        maxFileCount: maxAttachmentsCount,
        contentDisposition: 'attachment',
      },
      image: {
        maxFileSize: '4MB',
        maxFileCount: maxAttachmentsCount,
        contentDisposition: 'attachment',
      },
    })
      .middleware(async ({ req, files }) => {
        const isAuthenticated = await isAllowed(req);
        if (!isAuthenticated) {
          throw new UploadThingError({
            code: 'FORBIDDEN',
            message: 'Unauthorized',
          });
        }

        if (files.length > maxAttachmentsCount) {
          throw new UploadThingError({
            code: 'TOO_MANY_FILES',
            message: 'Too many files for attachments',
          });
        }

        return {};
      })
      .onUploadComplete(({ file }) => {
        logger.info({ file }, 'Attachments upload completed');
      }),
    imageUpload: f({
      image: {
        maxFileCount: 1,
        maxFileSize: '4MB',
      },
      blob: {
        maxFileCount: 1,
        maxFileSize: '4MB',
      },
    })
      .middleware(async ({ req, files }) => {
        const isAuthenticated = await isAllowed(req);
        if (!isAuthenticated) {
          throw new UploadThingError({
            code: 'FORBIDDEN',
            message: 'Unauthorized',
          });
        }

        for (const file of files) {
          if (
            typeof file.type !== 'string' ||
            !ECOSYSTEM_LOGO_IMAGE_ACCEPT.includes(file.type)
          ) {
            throw new UploadThingError({
              code: 'BAD_REQUEST',
              message: 'Unsupported image type',
            });
          }
        }

        return {};
      })
      .onUploadComplete(({ file }) => {
        logger.info({ file }, 'Image upload completed');
      }),
  } satisfies FileRouter;
}
