'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export interface ImageUploaderChildProps {
  isUploading?: boolean;
  uploadedFile?: string | null;
  previewUrl?: string | null;
  isDragActive?: boolean;
  onReset?: () => void;
}

interface ImageUploaderProps {
  isUploading?: boolean;
  uploadedFile?: string | null;
  onReset?: () => void;
  onUpload?: (files: File[]) => void;
  children?: React.ReactElement<ImageUploaderChildProps>;
  configuration?: {
    accept?: Record<string, string[]>;
    maxFiles?: number;
  };
}

export const ImageUploader = ({
  isUploading,
  uploadedFile,
  onReset,
  onUpload,
  children,
  configuration = {},
}: ImageUploaderProps) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file && file.type.startsWith('image')) {
        const fileUrl = URL.createObjectURL(file);
        setPreviewUrl(fileUrl);
        onUpload?.(acceptedFiles);
      }
    },
    [onUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: configuration.accept || {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    },
    maxFiles: configuration.maxFiles || 1,
  });

  const handleReset = () => {
    setPreviewUrl(null);
    onReset?.();
  };

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {React.Children.map(children, (child) =>
        React.isValidElement(child)
          ? React.cloneElement(child, {
              isUploading,
              uploadedFile,
              previewUrl,
              isDragActive,
              onReset: handleReset,
            } as ImageUploaderChildProps)
          : child,
      )}
    </div>
  );
};
