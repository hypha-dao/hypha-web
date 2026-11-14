'use client';

import * as React from 'react';
import Image from 'next/image';
import { toNextImageOptimizerSrc } from './optimize-remote-image';

type OptimizedAvatarImageProps = {
  src?: string;
  alt: string;
  /** CSS pixel box; `next/image` still emits a 2x srcset. */
  pixelSize: number;
  /** Above-the-fold portraits only. */
  priority?: boolean;
  className?: string;
  /** Shown when `src` is missing or `next/image` fails to load. */
  fallback?: React.ReactNode;
  onError?: () => void;
};

/**
 * Sized `next/image` for portraits and space marks.
 * Do not wrap this in Radix `AvatarImage` — that primitive loads `src` with
 * `new Image()` and duplicates the UploadThing original.
 */
export function OptimizedAvatarImage({
  src,
  alt,
  pixelSize,
  priority = false,
  className = 'aspect-square h-full w-full object-cover',
  fallback = null,
  onError,
}: OptimizedAvatarImageProps) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) {
    return fallback ? <>{fallback}</> : null;
  }

  const imageSrc = toNextImageOptimizerSrc(src, pixelSize * 2, 70);

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={pixelSize}
      height={pixelSize}
      sizes={`${pixelSize}px`}
      quality={70}
      priority={priority}
      unoptimized
      className={className}
      onError={() => {
        setFailed(true);
        onError?.();
      }}
    />
  );
}
