'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { ExternalLink, Maximize2, Play, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

function CallRecordingMediaPreview({
  src,
  poster,
  variant,
  playLabel,
  onOpen,
  openFullscreenLabel,
}: {
  src: string;
  poster?: string | null;
  variant: 'video' | 'audio';
  playLabel: string;
  onOpen: () => void;
  openFullscreenLabel: string;
}) {
  return (
    <button
      type="button"
      className="relative flex h-full w-full cursor-pointer items-center justify-center bg-black outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      onClick={onOpen}
      aria-label={playLabel}
    >
      {variant === 'video' ? (
        <video
          src={src}
          poster={poster ?? undefined}
          muted
          playsInline
          preload="metadata"
          className="max-h-full max-w-full object-contain"
        >
          <track kind="captions" />
        </video>
      ) : (
        <>
          <audio src={src} preload="metadata" className="sr-only">
            <track kind="captions" />
          </audio>
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-b from-muted/20 to-black px-4">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/20">
              <Play className="h-7 w-7 fill-current" aria-hidden />
            </span>
            <span className="line-clamp-2 text-center text-[11px] font-medium text-white/90">
              {playLabel}
            </span>
          </div>
        </>
      )}
      {variant === 'video' ? (
        <>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/15">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 text-white shadow-md ring-1 ring-white/20">
              <Play className="h-6 w-6 fill-current" aria-hidden />
            </span>
          </span>
          <span className="pointer-events-none absolute bottom-1 left-1 right-1 flex items-center justify-center gap-1 rounded bg-black/55 px-1 py-0.5 text-[9px] font-medium text-white/95">
            <span className="line-clamp-1">{playLabel}</span>
          </span>
          <span className="pointer-events-none absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-md border border-white/20 bg-black/55 text-white/95 shadow-sm">
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
          </span>
        </>
      ) : null}
    </button>
  );
}

function CallRecordingViewerDialog({
  open,
  onOpenChange,
  src,
  variant,
  title,
  contextLine,
  openHref,
  playLabel,
  openNewTabLabel,
  closeLabel,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  src: string;
  variant: 'video' | 'audio';
  title: string;
  contextLine: string;
  openHref: string;
  playLabel: string;
  openNewTabLabel: string;
  closeLabel: string;
}) {
  const mediaRef = React.useRef<HTMLVideoElement | HTMLAudioElement | null>(
    null,
  );

  React.useEffect(() => {
    if (!open) {
      const el = mediaRef.current;
      if (el) {
        el.pause();
        el.currentTime = 0;
      }
      return;
    }
    const el = mediaRef.current;
    if (!el) return;
    void el.play().catch(() => undefined);
  }, [open, src, variant]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        hideCloseButton
        overlayClassName="bg-black/75 backdrop-blur-sm supports-[backdrop-filter]:bg-black/65"
        className={cn(
          'fixed left-4 right-4 top-[4.5rem] bottom-4 z-50 flex max-h-none w-auto max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden border border-border/60 bg-black p-0 shadow-2xl sm:rounded-xl',
          'data-[state=open]:slide-in-from-bottom-2 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=closed]:zoom-out-95',
        )}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-border/50 bg-black/80 px-4 py-3 text-left sm:px-5">
          <DialogTitle className="pr-10 text-base font-semibold text-white">
            {title}
          </DialogTitle>
          <DialogDescription className="line-clamp-2 text-xs text-white/70">
            {contextLine}
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
          {variant === 'video' ? (
            <video
              ref={mediaRef as React.RefObject<HTMLVideoElement>}
              key={src}
              src={src}
              controls
              playsInline
              className="max-h-full max-w-full object-contain"
            >
              <track kind="captions" />
            </video>
          ) : (
            <div className="flex w-full max-w-md flex-col items-center gap-4 px-6 py-8">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-white ring-1 ring-white/15">
                <Play className="h-8 w-8 fill-current" aria-hidden />
              </span>
              <audio
                ref={mediaRef as React.RefObject<HTMLAudioElement>}
                key={src}
                src={src}
                controls
                className="w-full"
              >
                <track kind="captions" />
              </audio>
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 gap-2 border-t border-border/50 bg-black/80 px-4 py-3 sm:justify-between sm:px-5">
          <Button
            type="button"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
          >
            <X className="h-4 w-4" aria-hidden />
            {closeLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="border-white/20 bg-transparent text-white hover:bg-white/10 hover:text-white"
            asChild
          >
            <a href={openHref} target="_blank" rel="noopener noreferrer">
              {openNewTabLabel}
              <ExternalLink className="h-4 w-4" aria-hidden />
            </a>
          </Button>
          <Button
            type="button"
            className="bg-accent-9 text-accent-contrast hover:bg-accent-10"
            onClick={() => {
              const el = mediaRef.current;
              if (el?.paused) {
                void el.play().catch(() => undefined);
              } else {
                el?.pause();
              }
            }}
          >
            {playLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SpaceMemoryCallRecordingPlayer({
  src,
  poster,
  variant,
  title,
  contextLine,
  openHref,
  thumbShellClass,
}: {
  src: string;
  poster?: string | null;
  variant: 'video' | 'audio';
  title: string;
  contextLine: string;
  openHref: string;
  thumbShellClass: string;
}) {
  const t = useTranslations('CoherenceTab');
  const tCommon = useTranslations('Common');
  const [viewerOpen, setViewerOpen] = React.useState(false);
  const playLabel = t('spaceMemoryPlayCallRecording');
  const openFullscreenLabel = t('spaceMemoryOpenCallRecordingFullscreen');
  const openNewTabLabel = t('spaceMemoryOpenCallRecordingNewTab');

  return (
    <>
      <div className="group flex flex-col gap-2 rounded-lg">
        <div className={cn(thumbShellClass, 'aspect-[16/10]')}>
          <CallRecordingMediaPreview
            src={src}
            poster={poster}
            variant={variant}
            playLabel={playLabel}
            onOpen={() => setViewerOpen(true)}
            openFullscreenLabel={openFullscreenLabel}
          />
        </div>
        <div className="flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-auto gap-1.5 px-0 py-0 text-xs font-medium uppercase tracking-wide text-muted-foreground hover:bg-transparent hover:text-primary"
            onClick={() => setViewerOpen(true)}
          >
            <Maximize2 className="h-3.5 w-3.5" aria-hidden />
            {playLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-primary"
            asChild
          >
            <a
              href={openHref}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={openNewTabLabel}
              title={openNewTabLabel}
            >
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          </Button>
        </div>
      </div>
      <CallRecordingViewerDialog
        open={viewerOpen}
        onOpenChange={setViewerOpen}
        src={src}
        variant={variant}
        title={title}
        contextLine={contextLine}
        openHref={openHref}
        playLabel={playLabel}
        openNewTabLabel={openNewTabLabel}
        closeLabel={tCommon('close')}
      />
    </>
  );
}
