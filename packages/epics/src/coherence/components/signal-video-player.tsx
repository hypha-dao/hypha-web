'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('SignalCard');
  const [failedSrc, setFailedSrc] = React.useState<string | null>(null);

  if (video.kind === 'file') {
    // A file the CSP or the browser refuses would otherwise sit as a black box.
    if (failedSrc === video.src) {
      return (
        <div
          role="status"
          className={cn(
            'absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black p-4 text-center text-1 text-white/80',
            className,
          )}
          data-testid="signal-video-unplayable"
        >
          <span>{t('videoCannotPlay')}</span>
          <a
            href={video.src}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white underline underline-offset-2"
          >
            {t('videoOpenLink')}
          </a>
        </div>
      );
    }
    return (
      <video
        src={video.src}
        controls
        playsInline
        preload="metadata"
        onError={() => setFailedSrc(video.src)}
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
