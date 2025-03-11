'use client';

import Image from 'next/image';
import { LoaderIcon } from 'lucide-react';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { useCallback, useState, useEffect } from 'react';

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

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {uploadedFile || previewUrl ? (
        <div className="group relative max-h-[150px] min-h-[150px] w-full rounded-lg overflow-hidden">
          <Image
            src={uploadedFile || previewUrl || ''}
            alt="Uploaded Image"
            className="w-full h-full object-cover"
            width={554}
            height={150}
          />
          {isUploading && (
            <div className="absolute inset-0 bg-neutral-800 bg-opacity-50 flex items-center justify-center">
              <LoaderIcon className="animate-spin" />
            </div>
          )}
          {!isUploading && (
            <div
              className="hidden group-hover:flex absolute inset-0 bg-neutral-800 bg-opacity-50 items-center justify-center cursor-pointer"
              onClick={handleReset}
            >
              <Pencil1Icon width={24} height={24} />
            </div>
          )}
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
                handleFileInputChange({
                  target: { files },
                } as React.ChangeEvent<HTMLInputElement>);
              }
            };
            input.click();
          }}
        >
          {isDragging ? (
            <p className="font-medium text-muted-foreground w-full text-center">
              <span>Drop the file here</span>
            </p>
          ) : (
            <p className="font-medium text-muted-foreground w-full text-center">
              <span className="text-accent-11">Upload</span> an image
            </p>
          )}
        </div>
      )}
    </div>
  );
};