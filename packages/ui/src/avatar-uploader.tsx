import { ImageUploader, ImageUploaderChildProps } from './image-uploader';
import { LoaderIcon } from 'lucide-react';
import { Pencil1Icon } from '@radix-ui/react-icons';

type Size = 'xs' | 'sm' | 'md' | 'lg';

interface AvatarUploaderProps extends ImageUploaderChildProps {
  size?: Size;
}

type SizeMap = {
  [K in Size]: {
    container: number;
    icon: { width: number; height: number };
  };
};

export const AvatarUploader = ({
  size = 'md',
  isUploading,
  uploadedFile,
  previewUrl,
  isDragActive,
  onReset,
}: AvatarUploaderProps) => {
  const sizeMap: SizeMap = {
    xs: { container: 12, icon: { width: 8, height: 8 } },
    sm: { container: 24, icon: { width: 12, height: 12 } },
    md: { container: 40, icon: { width: 20, height: 20 } },
    lg: { container: 64, icon: { width: 24, height: 24 } },
  };

  const uploaderConfig = {
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    },
    maxFiles: 1,
  };

  const containerSize = sizeMap[size].container;
  const iconSize = sizeMap[size].icon;

  return (
    <ImageUploader
      uploadedFile={uploadedFile}
      isUploading={isUploading}
      onReset={onReset}
      configuration={uploaderConfig}
      onUpload={(files) => {
        console.log('Uploaded files:', files);
      }}
    >
      <div
        className="group relative rounded-md overflow-hidden"
        style={{ width: `${containerSize}px`, height: `${containerSize}px` }}
      >
        {uploadedFile || previewUrl ? (
          <>
            <img
              src={uploadedFile || previewUrl || ''}
              alt="Uploaded Avatar"
              className="w-full h-full object-cover"
              width={containerSize}
              height={containerSize}
            />
            {isUploading && (
              <div className="absolute inset-0 bg-neutral-800 bg-opacity-50 flex items-center justify-center">
                <LoaderIcon
                  className="animate-spin"
                  width={iconSize.width}
                  height={iconSize.height}
                />
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
                <Pencil1Icon {...iconSize} />
              </div>
            )}
          </>
        ) : (
          <div className="rounded-md border-2 flex items-center justify-center border-neutral-10 bg-transparent border-dashed cursor-pointer w-full h-full">
            {isDragActive ? (
              <span className="text-xs text-accent-11 text-center">
                Drop here
              </span>
            ) : (
              <Pencil1Icon {...iconSize} />
            )}
          </div>
        )}
      </div>
    </ImageUploader>
  );
};
