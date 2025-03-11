import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { NextRequest } from 'next/server';
import { createPeopleService } from '@hypha-platform/core';

const f = createUploadthing();

const getAuthenticatedUser = async (req: NextRequest) => {
  const authToken = req.headers.get('Authorization')?.split(' ')[1] || '';
  const peopleService = createPeopleService({ authToken });
  const user = await peopleService.findMe();
  return user;
};

export const ourFileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const user = await getAuthenticatedUser(req);

      if (!user) {
        throw new UploadThingError('Unauthorized');
      }

      return { userId: user.id };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      console.debug('ourFileRouter.onUploadComplete', { metadata, file });
      return;
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
