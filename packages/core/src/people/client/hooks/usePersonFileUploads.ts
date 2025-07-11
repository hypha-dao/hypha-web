'use client';

import { useFileUpload, editPersonFiles } from '@hypha-platform/core/client';
import React from 'react';
import { z } from 'zod';

type Files = z.infer<typeof editPersonFiles>;

export type UsePersonFileUploadsReturn = {
  isLoading: boolean;
  files:
    | {
        [K in keyof Files]: string;
      }
    | null;
  upload: (fileInput: Files) => Promise<void>;
};

export const usePersonFileUploads = (
  authToken?: string | null,
): UsePersonFileUploadsReturn => {
  const [files, setFiles] = React.useState<{ [K in keyof Files]: string }>(
    {} as { [K in keyof Files]: string },
  );
  const { upload, isUploading } = useFileUpload({
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const handleUpload = React.useCallback(
    async (fileInput: Files) => {
      const uploadPromises = Object.entries(fileInput).map(
        async ([key, file]) => {
          if (!file) return;

          try {
            const result = await upload([file as File]);
            if (result?.[0]?.ufsUrl) {
              setFiles((prev) => ({
                ...prev,
                [key]: result[0]?.ufsUrl ?? '',
              }));
            }
          } catch (error) {
            console.error(`Failed to upload file for ${key}:`, error);
            throw error;
          }
        },
      );

      await Promise.all(uploadPromises);
    },
    [upload],
  );

  return {
    isLoading: isUploading,
    files: isUploading ? null : files,
    upload: handleUpload,
  };
};
