'use client';

import { useDropzone, FileRejection } from 'react-dropzone';
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
  maxFileSize = 4 * 1024 * 1024,
  uploadText,
  enableImageResizer = false,
}: UploadLeadImageProps) => {
  const [preview, setPreview] = React.useState<string | null>(
    defaultImage || null,
  );

  React.useEffect(() => {
    setPreview(defaultImage || null);
  }, [defaultImage, setPreview]);

  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<any>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
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

  const onDropRejected = React.useCallback(
    (fileRejections: FileRejection[]) => {
      const tooLarge = fileRejections.some((rej) =>
        rej.errors.some((e) => e.code === 'file-too-large'),
      );

      if (tooLarge) {
        setError(
          'Your image is too large (max 4 MB) and could not be uploaded. Resize it and try again.',
        );
      } else {
        setError('File could not be uploaded.');
      }
      onChange(null);
    },
    [onChange],
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
    onDropRejected,
    maxFiles: 1,
    maxSize: maxFileSize,
    accept: {
      'image/png': [],
      'image/jpg': [],
      'image/jpeg': [],
      'image/webp': [],
    },
  });

  /** Prefer in-component preview (upload/crop); fall through to parent default URL immediately so we never flash an empty dashed box while defaultImage hydrates. */
  const displaySrc = preview ?? defaultImage ?? null;
  const showEmptyPlaceholder = !displaySrc && !imageSrc;

  return (
    <>
      <AspectRatio
        ratio={762 / 270}
        {...getRootProps()}
        className={clsx(
          'group cursor-pointer relative',
          'flex justify-center items-center overflow-hidden',
          'rounded-xl bg-accent-2',
          showEmptyPlaceholder && 'border border-neutral-11 border-dashed',
        )}
      >
        <input {...getInputProps()} />
        {displaySrc && <PreviewImg src={displaySrc} />}
        <PreviewOverlay isVisible={!displaySrc || isDragActive}>
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

      {error && <p className="mt-2 text-2 text-error-11">{error}</p>}

      {enableImageResizer && imageSrc && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="lead-image-crop-title"
          aria-describedby="lead-image-crop-desc"
        >
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-2xl">
            <div className="border-b border-border px-5 py-4">
              <h2
                id="lead-image-crop-title"
                className="text-lg font-semibold tracking-tight text-foreground"
              >
                Upload an image
              </h2>
              <p
                id="lead-image-crop-desc"
                className="mt-1 text-sm leading-relaxed text-muted-foreground"
              >
                Adjust how your image is framed, then save. Drag to reposition
                and use zoom to fit the banner area (JPEG, PNG, or WebP — max
                4&nbsp;MB).
              </p>
            </div>
            <div className="relative min-h-[min(55vh,440px)] w-full flex-1 bg-muted/40">
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={762 / 270}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-5 py-4">
              <Button
                type="button"
                variant="outline"
                colorVariant="neutral"
                size="lg"
                onClick={() => setImageSrc(null)}
              >
                Cancel
              </Button>
              <Button type="button" size="lg" onClick={confirmCrop}>
                Crop & Save
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
