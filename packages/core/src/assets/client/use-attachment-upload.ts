'use client';

import { generateReactHelpers } from '@uploadthing/react';
import type { UseFileUploadProps } from './types';
import type { CoreFileRouter } from '../server';

export const useAttachmentUpload = ({ headers }: UseFileUploadProps) => {
  const { useUploadThing } = generateReactHelpers<CoreFileRouter>();

  const { startUpload, isUploading } = useUploadThing('attachmentUploader', {
    headers,
  });

  return {
    upload: startUpload,
    isUploading,
  };
};
