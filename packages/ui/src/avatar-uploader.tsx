'use client';

import Image from 'next/image';
import { LoaderIcon } from 'lucide-react';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { useCallback, useState, useEffect } from 'react';

interface AvatarUploaderProps {
  isUploading: boolean;
  uploadedAvatar: string | null;
  onReset: () => void;
  onUpload: (files: File[]) => void;
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const AvatarUploader = ({
  isUploading,
  uploadedAvatar,
  onReset,
  onUpload,
  size = 'md',
}: AvatarUploaderProps) => {
  const [files, setFiles] = useState<File[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    if (files.length > 0) {
      const file = files[0];
      if (file && file.type.startsWith('image')) {
        const fileUrl = URL.createObjectURL(file);
        setPreviewUrl(fileUrl);
      }
    }
  }, [files]);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const droppedFiles = Array.from(e.dataTransfer.files);
      setFiles(droppedFiles);
      onUpload(droppedFiles);
    },
    [onUpload],
  );

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (selectedFiles) {
      const fileArray = Array.from(selectedFiles);
      setFiles(fileArray);
      onUpload(fileArray);
    }
  };

  const handleReset = () => {
    setFiles([]);
    setPreviewUrl(null);
    onReset();
  };

  const sizeMap = {
    xs: {
      container: 'w-[12px] h-[12px]',
      image: { width: 12, height: 12 },
      icon: { width: 8, height: 8 }
    },
    sm: {
      container: 'w-[24px] h-[24px]',
      image: { width: 24, height: 24 },
      icon: { width: 12, height: 12 }
    },
    md: {
      container: 'w-[40px] h-[40px]',
      image: { width: 40, height: 40 },
      icon: { width: 20, height: 20 }
    },
    lg: {
      container: 'w-[64px] h-[64px]',
      image: { width: 64, height: 64 },
      icon: { width: 24, height: 24 }
    }
  };

  return (
    <div
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {uploadedAvatar || previewUrl ? (
        <div className={`group relative rounded-md overflow-hidden ${sizeMap[size].container}`}>
          <Image
            src={uploadedAvatar || previewUrl || ''}
            alt="Uploaded Image"
            className="w-full h-full object-cover"
            width={sizeMap[size].image.width}
            height={sizeMap[size].image.height}
          />
          {isUploading && (
            <div className="absolute inset-0 bg-neutral-800 bg-opacity-50 flex items-center justify-center">
              <LoaderIcon className="animate-spin" {...sizeMap[size].icon} />
            </div>
          )}
          {!isUploading && (
            <div
              className="hidden group-hover:flex absolute inset-0 bg-neutral-800 bg-opacity-50 items-center justify-center cursor-pointer"
              onClick={handleReset}
            >
              <Pencil1Icon {...sizeMap[size].icon} />
            </div>
          )}
        </div>
      ) : (
        <div
          className={`rounded-md border-2 flex items-center justify-center border-neutral-10 bg-transparent border-dashed cursor-pointer ${sizeMap[size].container}`}
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) {
                handleFileInputChange({
                  target: { files },
                } as React.ChangeEvent<HTMLInputElement>);
              }
            };
            input.click();
          }}
        >
          <Pencil1Icon {...sizeMap[size].icon} />
        </div>
      )}
    </div>
  );
};
