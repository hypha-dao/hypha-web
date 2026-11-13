'use client';

import Image from 'next/image';
import { AvatarImage } from '@hypha-platform/ui';
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
 * Radix `AvatarImage` backed by `next/image` so UploadThing originals are
 * downscaled instead of fetched at full size.
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
    <AvatarImage asChild>
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
    </AvatarImage>
  );
}
