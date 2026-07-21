'use client';

import { useImageUpload } from '@hypha-platform/core/client';
import { schemaCreateSpaceFiles } from '@hypha-platform/core/client';
import React from 'react';
import { z } from 'zod';

type Files = z.infer<typeof schemaCreateSpaceFiles>;

const getUploadResultUrl = (result: unknown): string | undefined => {
  if (!Array.isArray(result) || result.length === 0) return undefined;
  const first = result[0] as { ufsUrl?: unknown; url?: unknown } | undefined;
  if (!first) return undefined;
  if (typeof first.ufsUrl === 'string' && first.ufsUrl) return first.ufsUrl;
  if (typeof first.url === 'string' && first.url) return first.url;
  return undefined;
};

export type UseSpaceFileUploadsReturn = {
  isLoading: boolean;
  files: { [K in keyof Files]?: string } | null;
  upload: (
    fileInput: Files,
    id: number,
  ) => Promise<{ [K in keyof Files]?: string }>;
  error: string | null;
  reset: () => void;
};

export const useSpaceFileUploads = (
  authToken?: string | null,
  onSuccess?: (
    uploadedFiles: { [K in keyof Files]?: string },
    id: number,
  ) => Promise<void> | void,
): UseSpaceFileUploadsReturn => {
  const [files, setFiles] = React.useState<
    { [K in keyof Files]?: string } | null
  >(null);
  const [error, setError] = React.useState<string | null>(null);
  const { upload, isUploading } = useImageUpload({
    authorizationToken: authToken ?? undefined,
  });

  const handleUpload = React.useCallback(
    async (fileInput: Files, id: number) => {
      const uploadedFiles: { [K in keyof Files]?: string } = {};

      const uploadPromises = Object.entries(fileInput).map(
        async ([key, file]) => {
          if (!file) return;

          try {
            if (file instanceof File) {
              const result = await upload([file]);
              const uploadedUrl = getUploadResultUrl(result);
              if (uploadedUrl) {
                uploadedFiles[key as keyof Files] = uploadedUrl;
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
      await onSuccess?.(uploadedFiles, id);
      return uploadedFiles;
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
