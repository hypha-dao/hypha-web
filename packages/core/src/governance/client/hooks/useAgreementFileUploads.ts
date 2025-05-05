'use client';

import { useFileUpload } from '@core/assets';
import { schemaCreateAgreementFiles } from '@core/governance/validation';
import React from 'react';
import { z } from 'zod';

type Files = z.infer<typeof schemaCreateAgreementFiles>;

export type UseAgreementFileUploadsReturn = {
  isLoading: boolean;
  files:
    | {
        [K in keyof Files]: Files[K] extends File[] ? string[] : string;
      }
    | null;
  upload: (fileInput: Files) => Promise<void>;
};

export const useAgreementFileUploads = (
  authToken?: string | null,
): UseAgreementFileUploadsReturn => {
  const [files, setFiles] = React.useState<{
    [K in keyof Files]: Files[K] extends File[] ? string[] : string;
  }>({} as any);
  const { upload, isUploading } = useFileUpload({
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const handleUpload = React.useCallback(
    async (fileInput: Files) => {
      const uploadPromises = Object.entries(fileInput).map(
        async ([key, fileOrFiles]) => {
          if (!fileOrFiles) return;

          try {
            if (fileOrFiles instanceof File) {
              const result = await upload([fileOrFiles]);
              if (result?.[0]?.ufsUrl) {
                setFiles((prev) => ({
                  ...prev,
                  [key]: result[0].ufsUrl,
                }));
              }
            } else if (Array.isArray(fileOrFiles)) {
              const result = await upload(fileOrFiles);
              if (result?.every((item) => item.ufsUrl)) {
                setFiles((prev) => ({
                  ...prev,
                  [key]: result.map((item) => item.ufsUrl),
                }));
              }
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
