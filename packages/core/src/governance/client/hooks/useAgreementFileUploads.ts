'use client';

import {
  useImageUpload,
  useAttachmentUpload,
  schemaCreateAgreementFiles,
  type UseFileUploadProps,
} from '@hypha-platform/core/client';
import React from 'react';
import { z } from 'zod';

type Files = z.infer<typeof schemaCreateAgreementFiles>;

export type UseAgreementFileUploadsReturn = {
  isLoading: boolean;
  files: {
    leadImage?: string;
    attachments?: string[];
  } | null;
  upload: (fileInput: Files, slug: string | null | undefined) => Promise<void>;
};

export const useAgreementFileUploads = (
  authToken?: string | null,
  onSuccess?: (
    uploadedFiles: {
      leadImage?: string;
      attachments?: string[];
    },
    slug?: string | null | undefined,
  ) => Promise<void> | void,
): UseAgreementFileUploadsReturn => {
  const [files, setFiles] = React.useState<{
    leadImage?: string;
    attachments?: string[];
  } | null>(null);

  const uploadProps: UseFileUploadProps = {
    headers: { Authorization: `Bearer ${authToken}` },
  };
  const { upload: uploadImage, isUploading: isUploadingImage } =
    useImageUpload(uploadProps);
  const { upload: uploadAttachment, isUploading: isUploadingAttachment } =
    useAttachmentUpload(uploadProps);

  const handleUpload = React.useCallback(
    async (fileInput: Files, slug: string | null | undefined) => {
      const uploadedFiles: {
        leadImage?: string;
        attachments?: string[];
      } = {};

      const uploadPromises = Object.entries(fileInput).map(
        async ([key, fileOrFiles]) => {
          if (!fileOrFiles) return;

          try {
            if (key === 'leadImage' && fileOrFiles instanceof File) {
              const result = await uploadImage([fileOrFiles]);
              if (result?.[0]?.ufsUrl) {
                uploadedFiles.leadImage = result[0].ufsUrl;
              }
            } else if (key === 'attachments' && Array.isArray(fileOrFiles)) {
              const result = await uploadAttachment(fileOrFiles);
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
      onSuccess?.(uploadedFiles, slug);
    },
    [uploadImage, uploadAttachment, onSuccess],
  );

  return {
    isLoading: isUploadingImage || isUploadingAttachment,
    files,
    upload: handleUpload,
  };
};
