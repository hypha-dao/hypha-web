'use client';

import { generateReactHelpers } from '@uploadthing/react';
import type { FileUploadProps } from './types';
import type { CoreFileRouter } from '../server';

export const useImageUpload = ({ authorizationToken }: FileUploadProps) => {
  const headers = authorizationToken
    ? new Headers({ Authorization: `Bearer ${authorizationToken}` })
    : new Headers();

  const { useUploadThing } = generateReactHelpers<CoreFileRouter>();

  const { startUpload, isUploading } = useUploadThing('imageUploader', {
    headers,
  });

  return {
    upload: startUpload,
    isUploading,
  };
};
