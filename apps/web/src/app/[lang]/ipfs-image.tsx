'use client';

import Image from 'next/image';
import { useIPFSFile } from '@hypha-platform/ipfs';

interface IPFSImageProps {
  src: string;
  alt?: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function IPFSImage({
  src,
  alt = '',
  width = 400,
  height = 400,
  className,
}: IPFSImageProps) {
  const { srcUrl, isLoading, error } = useIPFSFile(src);

  if (isLoading) {
    return (
      <div
        className="animate-pulse bg-gray-200 rounded"
        style={{ width, height }}
      />
    );
  }

  if (error) {
    return (
      <div
        className="flex flex-col items-center justify-center bg-gray-100 rounded p-4"
        style={{ width, height }}
      >
        <p className="text-sm text-gray-500 text-center">
          {error instanceof Error
            ? error.message
            : 'Failed to load image from IPFS'}
        </p>
        <p className="text-xs text-gray-400 mt-1">CID: {src}</p>
      </div>
    );
  }

  if (!srcUrl) {
    return (
      <div
        className="flex items-center justify-center bg-gray-100 rounded"
        style={{ width, height }}
      >
        <p className="text-sm text-gray-500">No image available</p>
      </div>
    );
  }

  return (
    <Image
      src={srcUrl}
      alt={alt}
      width={width}
      height={height}
      className={className}
    />
  );
}
