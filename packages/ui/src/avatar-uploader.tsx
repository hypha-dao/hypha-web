import Image from './image';
import { LoaderIcon } from 'lucide-react';
import { Pencil1Icon } from '@radix-ui/react-icons';
import { ImageUploaderChildProps } from './image-uploader';

interface AvatarUploaderProps extends ImageUploaderChildProps {
  size?: 'xs' | 'sm' | 'md' | 'lg';
}

export const AvatarUploader = ({
  size = 'md',
  isUploading,
  uploadedFile,
  previewUrl,
  isDragActive,
  onReset,
}: AvatarUploaderProps) => {
  const sizeMap = {
    xs: { container: 12, icon: { width: 8, height: 8 } },
    sm: { container: 24, icon: { width: 12, height: 12 } },
    md: { container: 40, icon: { width: 20, height: 20 } },
    lg: { container: 64, icon: { width: 24, height: 24 } },
  };

  return (
    <div
      className={`group relative rounded-md overflow-hidden w-[${sizeMap[size].container}px] h-[${sizeMap[size].container}px]`}
    >
      {uploadedFile || previewUrl ? (
        <>
          <Image
            src={uploadedFile || previewUrl || ''}
            alt="Uploaded Image"
            className="w-full h-full object-cover"
            width={sizeMap[size].container}
            height={sizeMap[size].container}
          />
          {isUploading && (
            <div className="absolute inset-0 bg-neutral-800 bg-opacity-50 flex items-center justify-center">
              <LoaderIcon className="animate-spin" {...sizeMap[size].icon} />
            </div>
          )}
          {!isUploading && (
            <div
              className="hidden group-hover:flex absolute inset-0 bg-neutral-800 bg-opacity-50 items-center justify-center cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onReset?.();
              }}
            >
              <Pencil1Icon {...sizeMap[size].icon} />
            </div>
          )}
        </>
      ) : (
        <div
          className={`rounded-md border-2 flex items-center justify-center border-neutral-10 bg-transparent border-dashed cursor-pointer w-full h-full`}
        >
          {isDragActive ? (
            <span className="text-xs text-accent-11 text-center">
              Drop here
            </span>
          ) : (
            <Pencil1Icon {...sizeMap[size].icon} />
          )}
        </div>
      )}
    </div>
  );
};
