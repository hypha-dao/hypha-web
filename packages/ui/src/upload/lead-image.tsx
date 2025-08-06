import { useDropzone } from 'react-dropzone';
import React from 'react';
import clsx from 'clsx';
import { PreviewOverlay } from './preview-overlay';
import { PreviewImg } from './preview-img';
import { AspectRatio } from '@radix-ui/react-aspect-ratio';

export type UploadLeadImageProps = {
  onChange: (acceptedFile: File | null) => void;
  defaultImage?: string;
  maxFileSize?: number;
  uploadText?: React.ReactNode;
};

export const UploadLeadImage = ({
  onChange,
  defaultImage,
  maxFileSize,
  uploadText,
}: UploadLeadImageProps) => {
  const [preview, setPreview] = React.useState<string | null>(
    defaultImage || null,
  );

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) {
        setPreview(defaultImage || null);
        onChange(null);
        return;
      }
      const reader = new FileReader();
      try {
        reader.onload = () => {
          setPreview(reader.result as string);
          onChange(acceptedFiles[0] || null);
        };
        reader.readAsDataURL(acceptedFiles[0] || new Blob());
      } catch (error) {
        console.error('Error reading file:', error);
        setPreview(defaultImage || null);
        onChange(null);
      }
    },
    [onChange, defaultImage],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: maxFileSize,
    accept: {
      'image/png': [],
      'image/jpg': [],
      'image/jpeg': [],
      'image/webp': [],
    },
  });

  return (
    <AspectRatio
      ratio={762 / 270}
      {...getRootProps()}
      className={clsx(
        'group cursor-pointer relative',
        'flex justify-center items-center overflow-hidden',
        'rounded-xl bg-accent-2',
        !preview && 'border border-neutral-11 border-dashed',
      )}
    >
      <input {...getInputProps()} />
      {preview && <PreviewImg src={preview} />}
      <PreviewOverlay isVisible={!preview || isDragActive}>
        {isDragActive ? (
          <span>Drop the image here</span>
        ) : (
          <span>
            {uploadText ? (
              uploadText
            ) : (
              <>
                <span className="text-accent-11">Upload</span> an image
              </>
            )}
          </span>
        )}
      </PreviewOverlay>
    </AspectRatio>
  );
};
