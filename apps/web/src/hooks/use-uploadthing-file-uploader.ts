'use client';

import { useState } from 'react';
import { generateReactHelpers } from '@uploadthing/react';
import type { OurFileRouter } from '@web/app/api/uploadthing/core';
import { useJwt } from '@web/hooks/use-jwt';

interface UseUploadThingFileUploaderProps {
  onUploadComplete?: (url: string) => void;
}

export const useUploadThingFileUploader = ({
  onUploadComplete,
}: UseUploadThingFileUploaderProps) => {
  const { jwt } = useJwt();
  const { useUploadThing } = generateReactHelpers<OurFileRouter>();
  const { startUpload } = useUploadThing('imageUploader', {
    headers: {
      Authorization: `Bearer ${jwt}`,
      'Content-Type': 'application/json',
    },
  });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleUploadComplete = (res: { url: string }[]): string | null => {
    console.log('Files: ', res);

    if (res && res[0]?.url) {
      setUploadedFile(res[0].url);
      onUploadComplete?.(res[0].url);
      return res[0].url;
    }
    setIsUploading(false);
    return null;
  };

  const handleDrop = async (files: File[]): Promise<string | null> => {
    setIsUploading(true);
    try {
      const res = await startUpload(files);
      if (res) {
        return handleUploadComplete(res);
      }
      return null;
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
      return null;
    }
  };

  return {
    isUploading,
    uploadedFile,
    setUploadedFile,
    handleDrop,
  };
};
