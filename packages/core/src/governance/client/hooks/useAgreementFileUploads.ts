'use client';

import { useFileUpload } from '@core/assets';
import { schemaCreateAgreementFiles } from '@core/governance/validation';
import React from 'react';
import { z } from 'zod';

type Files = z.infer<typeof schemaCreateAgreementFiles>;

export type UseAgreementFileUploadsReturn = {
  isLoading: boolean;
  files: {
    leadImage?: string;
    attachments?: string[];
  } | null;
  upload: (
    fileInput: Files,
    onSuccess?: (uploadedFiles: {
      leadImage?: string;
      attachments?: string[];
    }) => Promise<void> | void,
  ) => Promise<void>;
};

export const useAgreementFileUploads = (
  authToken?: string | null,
): UseAgreementFileUploadsReturn => {
  const [files, setFiles] = React.useState<{
    leadImage?: string;
    attachments?: string[];
  } | null>(null);
  const { upload, isUploading } = useFileUpload({
    headers: { Authorization: `Bearer ${authToken}` },
  });

  const handleUpload = React.useCallback(
    async (
      fileInput: Files,
      onSuccess?: (uploadedFiles: {
        leadImage?: string;
        attachments?: string[];
      }) => Promise<void> | void,
    ) => {
      const uploadedFiles: {
        leadImage?: string;
        attachments?: string[];
      } = {};

      const uploadPromises = Object.entries(fileInput).map(
        async ([key, fileOrFiles]) => {
          if (!fileOrFiles) return;

          try {
            if (key === 'leadImage' && fileOrFiles instanceof File) {
              const result = await upload([fileOrFiles]);
              if (result?.[0]?.ufsUrl) {
                uploadedFiles.leadImage = result[0].ufsUrl;
              }
            } else if (key === 'attachments' && Array.isArray(fileOrFiles)) {
              const result = await upload(fileOrFiles);
              if (result?.every((item) => item.ufsUrl)) {
                uploadedFiles.attachments = result.map((item) => item.ufsUrl);
              }
            }
          } catch (error) {
            console.error(`Failed to upload file for ${key}:`, error);
            throw error;
          }
        },
      );

      await Promise.all(uploadPromises);
      setFiles(uploadedFiles);
      if (onSuccess) {
        await onSuccess(uploadedFiles);
      }
    },
    [upload],
  );

  return {
    isLoading: isUploading,
    files,
    upload: handleUpload,
  };
};
