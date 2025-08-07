import React from 'react';
import { useDropzone } from 'react-dropzone';
import { LuImagePlus, LuImageUp } from 'react-icons/lu';
import clsx from 'clsx';
import { PreviewOverlay } from '../../../../../ui/src/upload/preview-overlay';
import { PreviewImg } from '../../../../../ui/src/upload/preview-img';

export type TokenIconUploadProps = {
  EditIcon?: React.ElementType;
  DropIcon?: React.ElementType;
  onChange: (acceptedFile: File | null) => void;
  defaultImage?: string;
  maxFileSize?: number;
};

export const TokenIconUpload = ({
  EditIcon = LuImagePlus,
  DropIcon = LuImageUp,
  onChange,
  defaultImage,
  maxFileSize,
}: TokenIconUploadProps) => {
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
          onChange(acceptedFiles[0] ?? null);
        };
        reader.readAsDataURL(acceptedFiles[0] ?? new Blob());
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
    <div
      {...getRootProps()}
      className={clsx(
        'group cursor-pointer relative',
        'flex justify-center items-center overflow-hidden',
        'min-w-9 w-9 h-9 rounded-xl bg-accent-5',
      )}
    >
      <input {...getInputProps()} />
      {typeof preview === 'string' && (
        <PreviewImg src={preview || '/placeholder/token-icon.png'} />
      )}
      <PreviewOverlay isVisible={!preview || isDragActive}>
        {isDragActive ? (
          <DropIcon className="h-5 w-5" />
        ) : (
          <EditIcon className="h-5 w-5" />
        )}
      </PreviewOverlay>
    </div>
  );
};
