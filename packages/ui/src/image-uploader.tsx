'use client';

import { useState } from 'react';
import {
  generateUploadDropzone,
  generateReactHelpers,
} from '@uploadthing/react';
import type { OurFileRouter } from '@web/app/api/uploadthing/core';
import Image from 'next/image';
import { LoaderIcon } from 'lucide-react';
import { Pencil1Icon } from '@radix-ui/react-icons';

interface ImageUploaderProps {
  initialImageUrl?: string;
  onUploadComplete?: (url: string) => void;
}

export const ImageUploader = ({
  initialImageUrl,
  onUploadComplete,
}: ImageUploaderProps) => {
  const [uploadedFile, setUploadedFile] = useState<string | null>(
    initialImageUrl || null,
  );
  const [isHovered, setIsHovered] = useState(false);

  const { useUploadThing } = generateReactHelpers<OurFileRouter>();
  const { startUpload, isUploading } = useUploadThing('imageUploader');

  const handleUploadComplete = (res: any) => {
    console.log('Files: ', res);

    if (res && res[0]?.url) {
      setUploadedFile(res[0]?.url);
      if (onUploadComplete) {
        onUploadComplete(res[0]?.url);
      }
    }
  };

  const handleDrop = async (acceptedFiles: File[]) => {
    const res = await startUpload(acceptedFiles);
    if (res) {
      handleUploadComplete(res);
    }
  };

  const UploadDropzone = generateUploadDropzone<OurFileRouter>();

  return (
    <div>
      {isUploading ? (
        <div className="w-full min-h-[150px] flex-row rounded-md border-2 items-center justify-center flex border-neutral-10 bg-transparent border-dashed">
          <LoaderIcon className="animate-spin" />
        </div>
      ) : uploadedFile ? (
        <div
          className="relative max-h-[150px] min-h-[150px] w-full rounded-lg overflow-hidden"
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => setUploadedFile(null)}
        >
          <Image
            src={uploadedFile}
            alt="Uploaded Image"
            className="w-full h-full object-cover"
            width={554}
            height={150}
          />
          {isHovered && (
            <div className="absolute inset-0 bg-neutral-800 bg-opacity-50 flex items-center justify-center cursor-pointer">
              <Pencil1Icon width={24} height={24} />
            </div>
          )}
        </div>
      ) : (
        <UploadDropzone
          endpoint="imageUploader"
          onClientUploadComplete={handleUploadComplete}
          onUploadError={(error: Error) => {
            alert(`ERROR! ${error.message}`);
          }}
          onChange={handleDrop}
          config={{
            appendOnPaste: true,
            mode: 'auto',
          }}
          content={{
            label: (
              <p className="font-medium text-muted-foreground w-full">
                <span className="text-accent-11">Upload</span> an image or{' '}
                <span className="text-accent-11">generate</span> one with AI
              </p>
            ),
            allowedContent: <></>,
            uploadIcon: <></>,
            button: <></>,
          }}
          appearance={{
            label: 'w-full',
            container:
              'w-full min-h-[150px] flex-row rounded-md border-2 border-neutral-10 bg-transparent border-dashed',
            button: 'hidden',
          }}
        />
      )}
    </div>
  );
};
