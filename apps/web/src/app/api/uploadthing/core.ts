import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { NextRequest } from 'next/server';
import { createPeopleService } from '@hypha-platform/core';

const f = createUploadthing();

const getAuthenticatedUser = async (req: NextRequest) => {
  const authToken = req.headers.get('Authorization')?.split(' ')[1] || '';
  const peopleService = createPeopleService({ authToken });
  const isValidAuthToken = await peopleService.verifyAuth();
  return isValidAuthToken;
};

export const ourFileRouter = {
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

export type OurFileRouter = typeof ourFileRouter;
