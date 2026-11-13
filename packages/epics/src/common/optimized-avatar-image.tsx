'use client';

import Image from 'next/image';
import { shouldOptimizeRemoteImage } from './optimize-remote-image';

type OptimizedAvatarImageProps = {
  src?: string;
  alt: string;
  /** CSS pixel box; `next/image` still emits a 2x srcset. */
  pixelSize: number;
  /** Above-the-fold portraits only. */
  priority?: boolean;
  className?: string;
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
}: OptimizedAvatarImageProps) {
  if (!src) return null;

  return (
    <Image
      src={src}
      alt={alt}
      width={pixelSize}
      height={pixelSize}
      sizes={`${pixelSize}px`}
      quality={70}
      priority={priority}
      unoptimized={!shouldOptimizeRemoteImage(src)}
      className={className}
    />
  );
}
