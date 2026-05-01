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

  const normalizeSvgMime = (file: File): File => {
    const isSvgByName = /\.svg$/i.test(file.name);
    const isFallbackMime =
      file.type === '' ||
      file.type === 'application/octet-stream' ||
      file.type === 'binary/octet-stream';

    if (isSvgByName && isFallbackMime) {
      return new File([file], file.name, {
        type: 'image/svg+xml',
        lastModified: file.lastModified,
      });
    }

    return file;
  };

  const upload: typeof startUpload = (files, input) => {
    const normalizedFiles = (files ?? []).map(normalizeSvgMime);
    return startUpload(normalizedFiles, input);
  };

  return {
    upload,
    isUploading,
  };
};
