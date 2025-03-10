'use client';

import Image from 'next/image';
import { LoaderIcon } from 'lucide-react';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { useCallback, useState } from 'react';

interface ImageUploaderProps {
  isUploading: boolean;
  uploadedFile: string | null;
  onReset: () => void;
  onUpload: (files: File[]) => void;
}

export const ImageUploader = ({
  isUploading,
  uploadedFile,
  onReset,
  onUpload,
}: ImageUploaderProps) => {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragging(false);
      const files = Array.from(e.dataTransfer.files);
      onUpload(files);
    },
    [onUpload],
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {isUploading ? (
        <div
          className={`w-full min-h-[150px] flex-row rounded-md border-2 items-center justify-center flex border-neutral-10 bg-transparent border-dashed ${
            isDragging ? 'bg-neutral-100' : ''
          }`}
        >
          <LoaderIcon className="animate-spin" />
        </div>
      ) : uploadedFile ? (
        <div
          className="group relative max-h-[150px] min-h-[150px] w-full rounded-lg overflow-hidden"
          onClick={() => {
            onReset();
          }}
        >
          <Image
            src={uploadedFile || ''}
            alt="Uploaded Image"
            className="w-full h-full object-cover"
            width={554}
            height={150}
          />
          <div className="hidden group-hover:flex absolute inset-0 bg-neutral-800 bg-opacity-50 items-center justify-center cursor-pointer">
            <Pencil1Icon width={24} height={24} />
          </div>
        </div>
      ) : (
        <div
          className="w-full min-h-[150px] flex-row rounded-md border-2 items-center justify-center flex border-neutral-10 bg-transparent border-dashed"
          onClick={() => {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.onchange = (e) => {
              const files = (e.target as HTMLInputElement).files;
              if (files) {
                onUpload(Array.from(files));
              }
            };
            input.click();
          }}
        >
          <p className="font-medium text-muted-foreground w-full text-center">
            <span className="text-accent-11">Upload</span> an image or{' '}
            <span className="text-accent-11">generate</span> one with AI
          </p>
        </div>
      )}
    </div>
  );
};
