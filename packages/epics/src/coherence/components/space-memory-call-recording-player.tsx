'use client';

import React from 'react';
import { createPortal } from 'react-dom';
import { useTranslations } from 'next-intl';
import { ExternalLink, Maximize2, Play, X } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';

const VIEWER_MAIN_COLUMN_INSET =
  'left-[var(--sidebar-left-width,0px)] right-[calc(var(--sidebar-right-width,0px)+var(--main-column-scrollbar-width,0px))]';

function CallRecordingMediaPreview({
  src,
  poster,
  variant,
  playLabel,
  onOpen,
}: {
  src: string;
  poster?: string | null;
  variant: 'video' | 'audio';
  playLabel: string;
  onOpen: () => void;
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
          className="h-full w-full object-cover"
        >
          <track kind="captions" />
        </video>
      ) : (
        <>
          <audio src={src} preload="metadata" className="sr-only">
            <track kind="captions" />
          </audio>
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted/30 px-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/15">
              <Play className="h-5 w-5 fill-current" aria-hidden />
            </span>
            <span className="line-clamp-2 text-center text-[11px] font-medium text-white/90">
              {playLabel}
            </span>
          </div>
        </>
      )}
      {variant === 'video' ? (
        <>
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white ring-1 ring-white/15">
              <Play className="h-5 w-5 fill-current" aria-hidden />
            </span>
          </span>
          <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/50 px-2 py-1 text-[10px] font-medium text-white/90">
            <span className="line-clamp-1">{playLabel}</span>
          </span>
          <span className="pointer-events-none absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-md border border-white/15 bg-black/50 text-white/90">
            <Maximize2 className="h-3 w-3" aria-hidden />
          </span>
        </>
      ) : null}
    </button>
  );
}

function CallRecordingViewerMenuBanner({
  open,
  title,
  contextLine,
  closeLabel,
  onClose,
}: {
  open: boolean;
  title: string;
  contextLine: string;
  closeLabel: string;
  onClose: () => void;
}) {
  if (!open || typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={cn(
        'pointer-events-none fixed z-[60] flex items-center justify-center px-16',
        VIEWER_MAIN_COLUMN_INSET,
      )}
      style={{ top: 0, height: 'var(--menu-top-height, 70px)' }}
    >
      <div className="pointer-events-auto flex min-w-0 max-w-[min(42rem,calc(100%-4rem))] flex-col items-center rounded-md bg-background/90 px-4 py-1.5 text-center shadow-sm ring-1 ring-border/60 backdrop-blur-sm">
        <p className="w-full truncate text-sm font-semibold leading-tight text-foreground">
          {title}
        </p>
        {contextLine ? (
          <p className="mt-0.5 line-clamp-1 w-full text-xs leading-tight text-muted-foreground">
            {contextLine}
          </p>
        ) : null}
      </div>
      <button
        type="button"
        className="pointer-events-auto absolute end-4 inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
        onClick={onClose}
        aria-label={closeLabel}
        title={closeLabel}
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </div>,
    document.body,
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
  const bannerTitle = title.trim() || playLabel;

  const requestPlay = React.useCallback(() => {
    const el = mediaRef.current;
    if (!el || !open) return;
    void el.play().catch(() => undefined);
  }, [open]);

  const bindMediaRef = React.useCallback(
    (el: HTMLVideoElement | HTMLAudioElement | null) => {
      mediaRef.current = el;
      if (el && open) {
        requestPlay();
      }
    },
    [open, requestPlay],
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
    const frame = window.requestAnimationFrame(() => {
      requestPlay();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [open, requestPlay, src, variant]);

  const handleClose = React.useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <>
      <CallRecordingViewerMenuBanner
        open={open}
        title={bannerTitle}
        contextLine={contextLine.trim()}
        closeLabel={closeLabel}
        onClose={handleClose}
      />
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          hideCloseButton
          overlayClassName="bg-black/75 backdrop-blur-sm supports-[backdrop-filter]:bg-black/65"
          className={cn(
            'fixed bottom-4 z-50 !flex max-h-none w-auto max-w-none !translate-x-0 !translate-y-0 flex-col gap-0 overflow-hidden border border-border/60 bg-black p-0 shadow-2xl sm:rounded-xl',
            'top-[var(--menu-top-height,70px)]',
            VIEWER_MAIN_COLUMN_INSET,
            'data-[state=open]:slide-in-from-bottom-2 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-bottom-2 data-[state=closed]:zoom-out-95',
          )}
        >
          <DialogTitle className="sr-only">{bannerTitle}</DialogTitle>
          {contextLine.trim() ? (
            <DialogDescription className="sr-only">
              {contextLine}
            </DialogDescription>
          ) : null}

          <div className="relative flex min-h-0 flex-1 items-center justify-center bg-black">
            {variant === 'video' ? (
              <video
                ref={bindMediaRef}
                key={src}
                src={src}
                controls
                autoPlay
                playsInline
                onLoadedData={requestPlay}
                onCanPlay={requestPlay}
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
                  ref={bindMediaRef}
                  key={src}
                  src={src}
                  controls
                  autoPlay
                  onLoadedData={requestPlay}
                  onCanPlay={requestPlay}
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
              onClick={handleClose}
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
    </>
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
  const openNewTabLabel = t('spaceMemoryOpenCallRecordingNewTab');

  return (
    <>
      <div className="group/open flex min-h-0 flex-1 flex-col gap-2">
        <div className={cn(thumbShellClass)}>
          <CallRecordingMediaPreview
            src={src}
            poster={poster}
            variant={variant}
            playLabel={playLabel}
            onOpen={() => setViewerOpen(true)}
          />
        </div>
        <div className="mt-auto flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            className="h-auto gap-1 px-0 py-0 text-1 text-muted-foreground hover:bg-transparent hover:text-foreground"
            onClick={() => setViewerOpen(true)}
          >
            <Maximize2 className="h-3 w-3" aria-hidden />
            {playLabel}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0 text-muted-foreground hover:text-foreground"
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
