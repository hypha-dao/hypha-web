import { ImageUploader, ImageUploaderChildProps } from './image-uploader';
import { LoaderIcon } from 'lucide-react';
import { Pencil1Icon } from '@radix-ui/react-icons';

export const LeadImageUploader = ({
  isUploading,
  uploadedFile,
  previewUrl,
  isDragActive,
  onReset,
}: ImageUploaderChildProps) => {
  const leadImageConfig = {
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    },
    maxFiles: 1,
  };

  return (
    <ImageUploader
      uploadedFile={uploadedFile}
      isUploading={isUploading}
      onReset={onReset}
      configuration={leadImageConfig}
      onUpload={(files) => {
        console.log('Uploaded files:', files);
      }}
    >
      <div className="w-full min-h-[150px] flex-row rounded-md border-2 items-center justify-center flex border-neutral-10 bg-transparent border-dashed">
        {uploadedFile || previewUrl ? (
          <div className="group relative max-h-[150px] min-h-[150px] w-full rounded-lg overflow-hidden">
            <img
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
                className="hidden group-hover:flex absolute top-2 right-2 bg-white p-2 rounded-lg shadow-md cursor-pointer"
                onClick={(e) => {
                  e.stopPropagation();
                  onReset?.();
                }}
              >
                <Pencil1Icon
                  width={20}
                  height={20}
                  className="text-neutral-1"
                />
              </div>
            )}
          </div>
        ) : (
          <p className="font-medium text-muted-foreground w-full text-center">
            {isDragActive ? (
              'Drop the file here'
            ) : (
              <span>
                <span className="text-accent-11">Upload</span> an image
              </span>
            )}
          </p>
        )}
      </div>
    </ImageUploader>
  );
};
