'use client';

import { useState } from 'react';
import { generateReactHelpers } from '@uploadthing/react';
import { useAuthHeader } from './use-auth-header';
import { CoreFileRouter } from '@hypha-platform/core/server';

interface UseUploadThingFileUploaderProps {
  onUploadComplete?: (url: string) => void;
}

export const useUploadThingFileUploader = ({
  onUploadComplete,
}: UseUploadThingFileUploaderProps) => {
  const { headers } = useAuthHeader();
  const { useUploadThing } = generateReactHelpers<CoreFileRouter>();
  const { startUpload } = useUploadThing('imageUploader', { headers });

  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);

  const handleUploadComplete = (res: { url: string }[]) => {
    console.log('Files: ', res);

    if (res && res[0]?.url) {
      setUploadedFile(res[0]?.url);
      if (onUploadComplete) {
        onUploadComplete(res[0]?.url);
      }
    }
    setIsUploading(false);
  };

  const handleDrop = async (files: File[]) => {
    setIsUploading(true);
    try {
      const res = await startUpload(files);
      if (res) {
        handleUploadComplete(res);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      setIsUploading(false);
    }
  };

  return {
    isUploading,
    uploadedFile,
    setUploadedFile,
    handleDrop,
  };
};
