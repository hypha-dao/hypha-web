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
  error: string | null;
  reset: () => void;
};

export const useSpaceFileUploads = (
  authToken?: string | null,
): UseSpaceFileUploadsReturn => {
  const [files, setFiles] = React.useState<{ [K in keyof Files]: string }>(
    {} as { [K in keyof Files]: string },
  );
  const [error, setError] = React.useState<string | null>(null);
  const { upload, isUploading } = useFileUpload({
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const handleUpload = React.useCallback(
    async (fileInput: Files) => {
      const uploadedUrls: { [K in keyof Files]?: string } = {};
      const uploadPromises = Object.entries(fileInput).map(
        async ([key, file]) => {
          if (!file) return;

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
          } catch (uploadError) {
            console.error(`Failed to upload file for ${key}:`, uploadError);
            setError(`Failed to upload file for ${key}`);
            throw uploadError;
          }
        },
      );
      await Promise.all(uploadPromises);
      return uploadedUrls;
    },
    [upload],
  );

  const reset = () => {
    setError(null);
    setFiles({} as { [K in keyof Files]: string });
  };

  return {
    isLoading: isUploading,
    files: isUploading ? null : files,
    upload: handleUpload,
    error,
    reset,
  };
};
