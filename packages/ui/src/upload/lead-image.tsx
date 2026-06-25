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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '../dialog';

export type UploadLeadImageCropLabels = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  cancel?: React.ReactNode;
  confirm?: React.ReactNode;
};

function buildDefaultCrop(maxMb: number): Required<UploadLeadImageCropLabels> {
  return {
    title: 'Upload an image',
    description: `Adjust how your image is framed, then save. Drag to reposition and use zoom to fit the banner area (JPEG, PNG, or WebP — max ${maxMb} MB).`,
    cancel: 'Cancel',
    confirm: 'Crop & Save',
  };
}

export type UploadLeadImageProps = {
  onChange: (acceptedFile: File | null) => void;
  /** Remote URL string, cleared with `null`, or omit while value is a File. */
  defaultImage?: string | null;
  maxFileSize?: number;
  accept?: Record<string, string[]>;
  aspectRatio?: number;
  uploadText?: React.ReactNode;
  enableImageResizer?: boolean;
  className?: string;
  imageClassName?: string;
  /** Overrides for crop dialog copy (defaults to English). */
  cropDialogLabels?: UploadLeadImageCropLabels;
  /** Dropzone errors and helper (defaults to English). */
  messages?: {
    dropHere?: React.ReactNode;
    fileTooLarge?: string;
    uploadFailed?: string;
  };
  outputMimeType?: 'image/jpeg' | 'image/png';
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
  maxFileSize = 16 * 1024 * 1024,
  accept,
  aspectRatio = 762 / 270,
  uploadText,
  enableImageResizer = false,
  className,
  imageClassName,
  cropDialogLabels,
  messages: messagesProp,
  outputMimeType = 'image/jpeg',
}: UploadLeadImageProps) => {
  const maxMb = React.useMemo(
    () => Math.max(0.1, Math.round((maxFileSize / (1024 * 1024)) * 10) / 10),
    [maxFileSize],
  );

  const cropLabels = React.useMemo(
    () => ({ ...buildDefaultCrop(maxMb), ...cropDialogLabels }),
    [maxMb, cropDialogLabels],
  );

  const messages = React.useMemo(
    () => ({
      dropHere: messagesProp?.dropHere ?? 'Drop the image here',
      fileTooLarge:
        messagesProp?.fileTooLarge ??
        `Your image is too large (max ${maxMb} MB) and could not be uploaded. Resize it and try again.`,
      uploadFailed: messagesProp?.uploadFailed ?? 'File could not be uploaded.',
    }),
    [
      maxMb,
      messagesProp?.dropHere,
      messagesProp?.fileTooLarge,
      messagesProp?.uploadFailed,
    ],
  );

  const [preview, setPreview] = React.useState<string | null>(
    defaultImage && typeof defaultImage === 'string' && defaultImage.trim()
      ? defaultImage
      : null,
  );

  // Sync remote/string defaults only. Do not clear preview when `defaultImage`
  // becomes undefined because the parent form value is a File — that transition
  // would wipe the crop/local preview right after the first upload.
  React.useEffect(() => {
    if (defaultImage === null) {
      setPreview(null);
      return;
    }
    if (typeof defaultImage === 'string') {
      if (defaultImage.trim().length === 0) {
        setPreview(null);
        return;
      }
      setPreview(defaultImage);
    }
  }, [defaultImage]);

  const [imageSrc, setImageSrc] = React.useState<string | null>(null);
  const [cropBox, setCropBox] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const onDrop = React.useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      if (!acceptedFiles.length) {
        setPreview(
          defaultImage === null
            ? null
            : typeof defaultImage === 'string' && defaultImage.trim() === ''
            ? null
            : defaultImage || null,
        );
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
        setError(messages.fileTooLarge);
      } else {
        setError(messages.uploadFailed);
      }
      onChange(null);
    },
    [messages.fileTooLarge, messages.uploadFailed, onChange],
  );

  const onCropComplete = React.useCallback(
    (_: unknown, pixels: typeof croppedAreaPixels) => {
      setCroppedAreaPixels(pixels);
    },
    [],
  );

  const confirmCrop = React.useCallback(async () => {
    if (!imageSrc || !croppedAreaPixels) return;
    const croppedImageUrl = await getCroppedImg(
      imageSrc,
      croppedAreaPixels,
      outputMimeType,
    );
    setPreview(croppedImageUrl);

    const fileExtension = outputMimeType === 'image/png' ? 'png' : 'jpg';
    const file = dataURLtoFile(croppedImageUrl, `cropped.${fileExtension}`);
    onChange(file);

    setImageSrc(null);
  }, [imageSrc, croppedAreaPixels, onChange]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    onDropRejected,
    maxFiles: 1,
    maxSize: maxFileSize,
    accept: accept ?? {
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
        ratio={aspectRatio}
        {...getRootProps()}
        className={clsx(
          'group cursor-pointer relative',
          'flex justify-center items-center overflow-hidden',
          'rounded-xl bg-neutral-3 text-muted-foreground',
          showEmptyPlaceholder && 'border border-dashed border-neutral-7',
          className,
        )}
      >
        <input {...getInputProps()} />
        {displaySrc && typeof displaySrc === 'string' && (
          <PreviewImg src={displaySrc} className={imageClassName} />
        )}
        <PreviewOverlay isVisible={!displaySrc || isDragActive}>
          {isDragActive ? (
            <span>{messages.dropHere}</span>
          ) : (
            <span>
              {uploadText ? (
                uploadText
              ) : (
                <>
                  <span className="text-foreground">Upload</span> an image
                </>
              )}
            </span>
          )}
        </PreviewOverlay>
      </AspectRatio>

      {error && <p className="mt-2 text-2 text-error-11">{error}</p>}

      <Dialog
        open={Boolean(enableImageResizer && imageSrc)}
        onOpenChange={(open) => {
          if (!open) setImageSrc(null);
        }}
      >
        <DialogContent
          hideCloseButton
          overlayClassName="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0"
          className={clsx(
            'fixed left-[50%] top-[50%] z-50 flex max-h-[90vh] w-full max-w-3xl translate-x-[-50%] translate-y-[-50%] flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-background p-0 shadow-2xl',
            'max-sm:h-[min(90vh,640px)] sm:max-h-[90vh]',
          )}
          onInteractOutside={(e) => e.preventDefault()}
        >
          <div className="border-b border-border px-5 py-4">
            <DialogTitle className="text-lg font-semibold tracking-tight text-foreground">
              {cropLabels.title}
            </DialogTitle>
            <DialogDescription className="mt-1 text-sm leading-relaxed text-muted-foreground">
              {cropLabels.description}
            </DialogDescription>
          </div>
          <div className="relative min-h-[min(55vh,440px)] w-full flex-1 bg-muted/40">
            {imageSrc ? (
              <Cropper
                image={imageSrc}
                crop={cropBox}
                zoom={zoom}
                aspect={aspectRatio}
                onCropChange={setCropBox}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : null}
          </div>
          <div className="flex items-center justify-end gap-3 border-t border-border bg-muted/20 px-5 py-4">
            <Button
              type="button"
              variant="outline"
              colorVariant="neutral"
              size="lg"
              onClick={() => setImageSrc(null)}
            >
              {cropLabels.cancel}
            </Button>
            <Button type="button" size="lg" onClick={confirmCrop}>
              {cropLabels.confirm}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};
