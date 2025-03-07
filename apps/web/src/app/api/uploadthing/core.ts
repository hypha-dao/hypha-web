import { createUploadthing, type FileRouter } from 'uploadthing/next';
import { UploadThingError } from 'uploadthing/server';
import { NextRequest } from 'next/server';

const f = createUploadthing();

const getAuthToken = async (req: NextRequest) => {
  const authToken = req.headers.get('Authorization')?.split(' ')[1] || '';
  return authToken;
};

export const ourFileRouter = {
  imageUploader: f({
    image: {
      maxFileSize: '4MB',
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req }) => {
      const authToken = await getAuthToken(req);

      if (authToken === null || authToken === 'undefined') {
        throw new UploadThingError('Unauthorized');
      }

      return { authToken };
    })
    .onUploadComplete(async ({ metadata, file }) => {
      const { authToken } = metadata; // TODO: integrate peopleService with update method

      return console.log('File uploaded:', file);
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;
