'use client';

import { cn } from '@hypha-platform/ui-utils';
import type { SignalVideoEmbed } from '../utils/signal-video';

/** Fills a `relative` parent. YouTube and Vimeo stay in an iframe; files use `<video>`. */
export function SignalVideoPlayer({
  video,
  title,
  className,
}: {
  video: SignalVideoEmbed;
  title: string;
  className?: string;
}) {
  if (video.kind === 'file') {
    return (
      <video
        src={video.src}
        controls
        playsInline
        preload="metadata"
        className={cn(
          'absolute inset-0 h-full w-full bg-black object-contain',
          className,
        )}
      />
    );
  }

  return (
    <iframe
      src={video.src}
      title={title}
      loading="lazy"
      className={cn(
        'absolute inset-0 h-full w-full border-0 bg-black',
        className,
      )}
      allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
      allowFullScreen
    />
  );
}
