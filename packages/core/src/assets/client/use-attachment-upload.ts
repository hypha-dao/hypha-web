'use client';

import { generateReactHelpers } from '@uploadthing/react';
import React from 'react';
import type { FileUploadProps } from './types';
import type { CoreFileRouter } from '../server';

const { useUploadThing } = generateReactHelpers<CoreFileRouter>();

export const useAttachmentUpload = ({
  authorizationToken,
}: FileUploadProps) => {
  const headers = React.useMemo(
    () =>
      authorizationToken
        ? new Headers({ Authorization: `Bearer ${authorizationToken}` })
        : new Headers(),
    [authorizationToken],
  );

  const { startUpload, isUploading } = useUploadThing('attachmentUploader', {
    headers,
  });

  return {
    upload: startUpload,
    isUploading,
  };
};
