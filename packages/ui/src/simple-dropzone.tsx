import { Image } from '@hypha-platform/ui';
import { useDropzone } from 'react-dropzone';
import { useEffect } from 'react';

export const SimpleDropzone = () => {
  const { acceptedFiles, getRootProps, getInputProps, isDragActive } =
    useDropzone({
      maxFiles: 1,
      maxSize: 1000000,
      accept: { 'image/png': [], 'image/jpg': [], 'image/jpeg': [] },
    });

  const previewUrl =
    acceptedFiles.length > 0 ? URL.createObjectURL(acceptedFiles[0]) : null;

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  return (
    <div {...getRootProps({ className: 'dropzone' })}>
      <section className="border border-neutral-11 border-dashed rounded-lg w-full h-[150px] flex justify-center items-center">
        <input {...getInputProps()} />
        {isDragActive ? (
          <p
            className={`font-medium text-muted-foreground w-full text-center text-accent-11 ${
              previewUrl ? 'hidden' : ''
            }`}
          >
            <span>Drop the file here</span>
          </p>
        ) : (
          <p
            className={`font-medium text-muted-foreground w-full text-center ${
              previewUrl ? 'hidden' : ''
            }`}
          >
            <span className="text-accent-11">Upload</span> an image
          </p>
        )}
        {previewUrl && (
          <Image
            width={100}
            height={150}
            src={previewUrl}
            alt="Preview"
            className="w-full max-h-[150px] cursor-pointer"
          />
        )}
      </section>
    </div>
  );
};
