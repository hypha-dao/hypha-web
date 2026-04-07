'use client';

import React from 'react';
import { z } from 'zod';
import { schemaCreateAgreementFiles } from '../../validation';
import { Attachment } from '../../types';
import { useAttachmentUpload, useImageUpload } from '../../../assets/client';

type Files = z.infer<typeof schemaCreateAgreementFiles>;

export type UseAgreementFileUploadsReturn = {
  isLoading: boolean;
  files: {
    leadImage?: string;
    attachments?: (string | Attachment)[];
  } | null;
  upload: (fileInput: Files, slug: string | null | undefined) => Promise<void>;
};

export const useAgreementFileUploads = (
  authToken?: string | null,
  onSuccess?: (
    uploadedFiles: {
      leadImage?: string;
      attachments?: (string | Attachment)[];
    },
    slug?: string | null | undefined,
  ) => Promise<void> | void,
): UseAgreementFileUploadsReturn => {
  const [files, setFiles] = React.useState<{
    leadImage?: string;
    attachments?: (string | Attachment)[];
  } | null>(null);

  const { upload: uploadImage, isUploading: isUploadingImage } = useImageUpload(
    { authorizationToken: authToken ?? undefined },
  );
  const { upload: uploadAttachment, isUploading: isUploadingAttachment } =
    useAttachmentUpload({ authorizationToken: authToken ?? undefined });

  const handleUpload = React.useCallback(
    async (fileInput: Files, slug: string | null | undefined) => {
      const uploadedFiles: {
        leadImage?: string;
        attachments?: (string | Attachment)[];
      } = {};

      const uploadPromises = Object.entries(fileInput).map(
        async ([key, fileOrFiles]) => {
          if (!fileOrFiles) return;

          try {
            if (key === 'leadImage') {
              if (fileOrFiles instanceof File) {
                const result = await uploadImage([fileOrFiles]);
                if (result?.[0]?.ufsUrl) {
                  uploadedFiles.leadImage = result[0].ufsUrl;
                }
              } else if (typeof fileOrFiles === 'string') {
                uploadedFiles.leadImage = fileOrFiles;
              }
            } else if (key === 'attachments' && Array.isArray(fileOrFiles)) {
              const areUrls = fileOrFiles.every(
                (item) =>
                  typeof item === 'string' ||
                  (typeof item === 'object' && item !== null && 'url' in item),
              );

              if (areUrls) {
                uploadedFiles.attachments = fileOrFiles.map((item) =>
                  typeof item === 'string'
                    ? item
                    : {
                        name: (item as any).name || '',
                        url: (item as any).url,
                      },
                ) as (string | Attachment)[];
              } else {
                const fileArray = fileOrFiles.filter(
                  (item) => item instanceof File,
                ) as File[];
                if (fileArray.length > 0) {
                  const result = await uploadAttachment(fileArray);
                  if (result?.every((item) => item.ufsUrl)) {
                    uploadedFiles.attachments = result.map((item) => ({
                      name: item.name,
                      url: item.ufsUrl,
                    }));
                  }
                }
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
