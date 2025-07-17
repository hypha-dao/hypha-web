'use client';

import { useFileUpload } from '@hypha-platform/core/client';
import { schemaCreateSpaceFiles } from '@hypha-platform/core/client';
import React from 'react';
import { z } from 'zod';

type Files = z.infer<typeof schemaCreateSpaceFiles>;

export type UseSpaceFileUploadsReturn = {
  isLoading: boolean;
  files: { [K in keyof Files]?: string } | null;
  upload: (fileInput: Files, slug: string | null | undefined) => Promise<void>;
  error: string | null;
  reset: () => void;
};

export const useSpaceFileUploads = (
  authToken?: string | null,
  onSuccess?: (
    uploadedFiles: { [K in keyof Files]?: string },
    slug?: string | null | undefined,
  ) => Promise<void> | void,
): UseSpaceFileUploadsReturn => {
  const [files, setFiles] = React.useState<
    { [K in keyof Files]?: string } | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const { upload, isUploading } = useFileUpload({
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const handleUpload = React.useCallback(
    async (fileInput: Files, slug: string | null | undefined) => {
      const uploadedFiles: { [K in keyof Files]?: string } = {};

      const uploadPromises = Object.entries(fileInput).map(
        async ([key, file]) => {
          if (!file) return;

          try {
            if (file instanceof File) {
              const result = await upload([file]);
              if (result?.[0]?.ufsUrl) {
                uploadedFiles[key as keyof Files] = result[0].ufsUrl;
              }
            }
          } catch (uploadError) {
            console.error(`Failed to upload file for ${key}:`, uploadError);
            setError(`Failed to upload file for ${key}`);
            throw uploadError;
          }
        },
      );

      await Promise.all(uploadPromises);
      setFiles(uploadedFiles);
      await onSuccess?.(uploadedFiles, slug);
    },
    [upload, onSuccess],
  );

  const reset = React.useCallback(() => {
    setError(null);
    setFiles(null);
  }, []);

  return {
    isLoading: isUploading,
    files: isUploading ? null : files,
    upload: handleUpload,
    error,
    reset,
  };
};
