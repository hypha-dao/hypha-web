import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { NextRequest } from 'next/server';

import { getDb } from '@core/common/server/get-db';
import { verifyAuth } from '@core/people/server/queries';

const f = createUploadthing();

const getAuthenticatedUser = async (req: NextRequest) => {
  const authToken = req.headers.get('Authorization')?.split(' ')[1];
  const isValidAuthToken = await verifyAuth({ db: getDb({ authToken }) });
  return isValidAuthToken;
};

export const fileRouter: FileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const isValidAuthToken = await getAuthenticatedUser(req);

      if (!isValidAuthToken) {
        throw new UploadThingError('Unauthorized');
      }

      return { isAuthenticated: true };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.debug('ourFileRouter.onUploadComplete', { metadata, file });
      return;
    }),
} satisfies FileRouter;

export type CoreFileRouter = typeof fileRouter;
