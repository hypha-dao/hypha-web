'use client';

import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AvatarUploader } from './avatar-uploader';
import { LeadImageUploader } from './lead-image-uploader';

interface ImageUploaderProps {
  isUploading?: boolean;
  uploadedFile?: string | null;
  onReset?: () => void;
  onUpload?: (files: File[]) => void;
  children?: React.ReactNode;
}

export interface ImageUploaderChildProps {
  isUploading?: boolean;
  uploadedFile?: string | null;
  previewUrl?: string | null;
  isDragActive?: boolean;
  onReset?: () => void;
}

type ImageUploaderComponent = React.FC<ImageUploaderProps> & {
  Avatar: typeof AvatarUploader;
  Lead: typeof LeadImageUploader;
};

export const ImageUploader: ImageUploaderComponent = ({
  isUploading,
  uploadedFile,
  onReset,
  onUpload,
  children,
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
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    },
  });

  const handleReset = () => {
    setPreviewUrl(null);
    onReset?.();
  };

  const childrenWithProps = React.Children.map(children, (child) => {
    if (React.isValidElement(child)) {
      return React.cloneElement(
        child as React.ReactElement<ImageUploaderChildProps>,
        {
          isUploading,
          uploadedFile,
          previewUrl,
          isDragActive,
          onReset: handleReset,
        },
      );
    }
    return child;
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {childrenWithProps}
    </div>
  );
};

ImageUploader.Avatar = AvatarUploader;
ImageUploader.Lead = LeadImageUploader;
