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
  defaultImage?: string | File;
  maxFileSize?: number;
};

export const TokenIconUpload = ({
  EditIcon = LuImagePlus,
  DropIcon = LuImageUp,
  onChange,
  defaultImage,
  maxFileSize,
}: TokenIconUploadProps) => {
  const [preview, setPreview] = React.useState<string | null>(() =>
    typeof defaultImage === 'string' ? defaultImage || null : null,
  );

  // Sync preview with controlled value. For File values use readAsDataURL — not
  // createObjectURL — because RHF can pass a new File reference on re-renders;
  // revoking the previous blob URL in effect cleanup races the img and shows a
  // broken image.
  React.useEffect(() => {
    if (typeof defaultImage === 'string') {
      setPreview(defaultImage || null);
      return;
    }
    if (defaultImage instanceof File) {
      let cancelled = false;
      const reader = new FileReader();
      reader.onload = () => {
        if (!cancelled) {
          setPreview(reader.result as string);
        }
      };
      reader.onerror = () => {
        if (!cancelled) {
          setPreview(null);
        }
      };
      reader.readAsDataURL(defaultImage);
      return () => {
        cancelled = true;
      };
    }
    setPreview(null);
  }, [defaultImage]);

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) {
        onChange(null);
        return;
      }
      try {
        onChange(acceptedFiles[0] ?? null);
      } catch (error) {
        console.error('Error reading file:', error);
        onChange(null);
      }
    },
    [onChange],
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
        <PreviewImg src={preview || '/placeholder/token-icon.svg'} />
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
