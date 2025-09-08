'use client';

import { useImageUpload, editPersonFiles } from '@hypha-platform/core/client';
import { useCallback, useState } from 'react';
import { z } from 'zod';

export type PersonFiles = z.infer<typeof editPersonFiles>;

interface UsePeopleFileUploadsParams {
  authToken?: string | null;
}

export const usePeopleFileUploads = ({
  authToken,
}: UsePeopleFileUploadsParams) => {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { upload: uploadImage } = useImageUpload({
    headers: {
      Authorization: `Bearer ${authToken || ''}`,
    },
  });

  const upload = useCallback(
    async (fileInput: Partial<PersonFiles>): Promise<Partial<PersonFiles>> => {
      setIsUploading(true);
      setError(null);

      try {
        const uploadedFiles: Partial<PersonFiles> = {};

        const uploadPromises = Object.entries(fileInput).map(
          async ([key, file]) => {
            if (!file) return;

            if (file instanceof File) {
              const result = await uploadImage([file]);
              if (result?.[0]?.ufsUrl) {
                uploadedFiles[key as keyof PersonFiles] = result[0].ufsUrl;
              }
            } else if (typeof file === 'string') {
              uploadedFiles[key as keyof PersonFiles] = file;
            }
          },
        );

        await Promise.all(uploadPromises);
        return uploadedFiles;
      } catch (err) {
        console.error('File upload error:', err);
        setError('Failed to upload files');
        throw err;
      } finally {
        setIsUploading(false);
      }
    },
    [uploadImage],
  );

  return {
    upload,
    isUploading,
    error,
  };
};
