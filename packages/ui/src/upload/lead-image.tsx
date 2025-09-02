'use client';

import { useDropzone } from 'react-dropzone';
import React from 'react';
import clsx from 'clsx';
import { PreviewOverlay } from './preview-overlay';
import { PreviewImg } from './preview-img';
import { AspectRatio } from '@radix-ui/react-aspect-ratio';
import Cropper from 'react-easy-crop';
import { getCroppedImg } from '@hypha-platform/ui-utils';
import { Button } from '../button';

export type UploadLeadImageProps = {
  onChange: (acceptedFile: File | null) => void;
  defaultImage?: string;
  maxFileSize?: number;
  uploadText?: React.ReactNode;
  enableImageResizer?: boolean;
};

function dataURLtoFile(dataUrl: string, filename: string) {
  if (!dataUrl) throw new Error('dataUrl is undefined');
  const arr = dataUrl.split(',');
  const mime = arr[0]?.match(/:(.*?);/)?.[1] || 'image/jpeg';
  const bstr = atob(arr[1] || '');
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}

export const UploadLeadImage = ({
  onChange,
  defaultImage,
  maxFileSize,
  uploadText,
  enableImageResizer = false,
}: UploadLeadImageProps) => {
  const [preview, setPreview] = React.useState<string | null>(
    defaultImage || null,
  );

  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<any>(null);

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      if (!acceptedFiles.length) {
        setPreview(defaultImage || null);
        onChange(null);
        return;
      }

      const file = acceptedFiles[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        if (enableImageResizer) {
          setImageSrc(result);
        } else {
          setPreview(result);
          onChange(file);
        }
      };
      reader.readAsDataURL(file);
    },
    [onChange, defaultImage, enableImageResizer],
  );

  const onCropComplete = React.useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const confirmCrop = React.useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const croppedImageUrl = await getCroppedImg(imageSrc, croppedAreaPixels);
    setPreview(croppedImageUrl);

    const file = dataURLtoFile(croppedImageUrl, 'cropped.jpg');
    onChange(file);

    setImageSrc(null);
  }, [imageSrc, croppedAreaPixels, onChange]);

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
    <>
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

      {enableImageResizer && imageSrc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70">
          <div className="relative w-[600px] h-[400px] bg-white rounded-xl overflow-hidden">
            <Cropper
              image={imageSrc}
              crop={crop}
              zoom={zoom}
              aspect={762 / 270}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-4">
              <Button onClick={() => setImageSrc(null)}>Cancel</Button>
              <Button onClick={confirmCrop}>Crop & Save</Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
