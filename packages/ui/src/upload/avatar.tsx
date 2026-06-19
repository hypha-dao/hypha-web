import React from 'react';
import { FileRejection, useDropzone } from 'react-dropzone';
import { LuImagePlus, LuImageUp } from 'react-icons/lu';
import clsx from 'clsx';
import { PreviewOverlay } from './preview-overlay';
import { PreviewImg } from './preview-img';
import { Text } from '@radix-ui/themes';

export type UploadAvatarProps = {
  EditIcon?: React.ElementType;
  DropIcon?: React.ElementType;
  onChange: (acceptedFile: File | null) => void;
  defaultImage?: string;
  maxFileSize?: number;
  required?: boolean;
  accept?: Record<string, string[]>;
  className?: string;
  imageClassName?: string;
};

export const UploadAvatar = ({
  EditIcon = LuImagePlus,
  DropIcon = LuImageUp,
  onChange,
  defaultImage,
  maxFileSize,
  required = false,
  accept,
  className,
  imageClassName,
}: UploadAvatarProps) => {
  const isSvgAllowed = Boolean(accept?.['image/svg+xml']);
  const dropzoneAccept = React.useMemo(() => {
    const baseAccept = accept ?? {
      'image/png': [],
      'image/jpg': [],
      'image/jpeg': [],
      'image/webp': [],
    };

    if (!isSvgAllowed) {
      return baseAccept;
    }

    return {
      ...baseAccept,
      'application/octet-stream': ['.svg'],
      'binary/octet-stream': ['.svg'],
    };
  }, [accept, isSvgAllowed]);
  const [preview, setPreview] = React.useState<string | null>(
    defaultImage || null,
  );

  React.useEffect(() => {
    setPreview(defaultImage || null);
  }, [defaultImage, setPreview]);

  const normalizeSvgMime = React.useCallback((file: File): File => {
    const isSvgByName = /\.svg$/i.test(file.name);
    const isFallbackMime =
      file.type === '' ||
      file.type === 'application/octet-stream' ||
      file.type === 'binary/octet-stream';

    if (isSvgByName && isFallbackMime) {
      return new File([file], file.name, {
        type: 'image/svg+xml',
        lastModified: file.lastModified,
      });
    }

    return file;
  }, []);

  const onDrop = React.useCallback(
    (acceptedFiles: File[], fileRejections: FileRejection[]) => {
      if (!acceptedFiles.length) {
        if (fileRejections.length > 0) {
          // Keep current preview/value when rejected files are dropped.
          return;
        }
        setPreview(defaultImage || null);
        onChange(null);
        return;
      }
      const normalizedFile = normalizeSvgMime(acceptedFiles[0] as File);
      const reader = new FileReader();
      reader.onload = () => {
        setPreview(reader.result as string);
        onChange(normalizedFile);
      };
      reader.onerror = (event) => {
        console.error('Error reading file:', event);
        setPreview(defaultImage || null);
        onChange(null);
      };
      reader.readAsDataURL(normalizedFile);
    },
    [onChange, defaultImage, normalizeSvgMime],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    maxFiles: 1,
    maxSize: maxFileSize,
    accept: dropzoneAccept,
  });

  return (
    <div
      {...getRootProps()}
      className={clsx(
        'group cursor-pointer relative',
        'flex justify-center items-center overflow-hidden',
        'min-w-9 w-9 h-9 rounded-xl',
        'border border-dashed border-neutral-7 bg-neutral-3 text-neutral-11',
        'transition-colors hover:border-neutral-8 hover:bg-neutral-4',
        className,
      )}
    >
      <input {...getInputProps()} />
      {preview && <PreviewImg src={preview} className={imageClassName} />}
      <PreviewOverlay isVisible={!preview || isDragActive}>
        <div className="inline-block">
          {isDragActive ? (
            <DropIcon className="h-5 w-5" />
          ) : (
            <EditIcon className="h-5 w-5" />
          )}
          {required && (
            <Text className="text-destructive absolute -right-2 -top-3 z-10">
              *
            </Text>
          )}
        </div>
      </PreviewOverlay>
    </div>
  );
};
