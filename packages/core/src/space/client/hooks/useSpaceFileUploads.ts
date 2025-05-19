'use client';

import { useFileUpload } from '@core/assets';
import { schemaCreateSpaceFiles } from '@core/space/validation';
import React from 'react';
import { z } from 'zod';

type Files = z.infer<typeof schemaCreateSpaceFiles>;

export type UseSpaceFileUploadsReturn = {
  isLoading: boolean;
  files:
    | {
        [K in keyof Files]: string;
      }
    | null;
  upload: (fileInput: Files) => Promise<{ [K in keyof Files]?: string }>;
};

export const useSpaceFileUploads = (
  authToken?: string | null,
): UseSpaceFileUploadsReturn => {
  const [files, setFiles] = React.useState<{ [K in keyof Files]: string }>(
    {} as { [K in keyof Files]: string },
  );
  const { upload, isUploading } = useFileUpload({
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const handleUpload = React.useCallback(
    async (fileInput: Files) => {
      const uploadedUrls: { [K in keyof Files]?: string } = {};
      const uploadPromises = Object.entries(fileInput).map(
        async ([key, file]) => {
          if (!file) return;

          // If file is a string, set it directly as the URL
          if (typeof file === 'string') {
            setFiles((prev) => ({
              ...prev,
              [key]: file,
            }));
            uploadedUrls[key as keyof Files] = file;
            return file;
          }

          try {
            const result = await upload([file]);
            if (result?.[0]?.ufsUrl) {
              setFiles((prev) => ({
                ...prev,
                [key]: result[0].ufsUrl,
              }));
              uploadedUrls[key as keyof Files] = result[0].ufsUrl;
              return result[0].ufsUrl;
            }
          } catch (error) {
            console.error(`Failed to upload file for ${key}:`, error);
            throw error;
          }
        },
      );

      await Promise.all(uploadPromises);
      return uploadedUrls;
    },
    [upload],
  );

  return {
    isLoading: isUploading,
    files: isUploading ? null : files,
    upload: handleUpload,
  };
};
