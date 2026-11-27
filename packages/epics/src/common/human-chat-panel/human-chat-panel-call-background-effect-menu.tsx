'use client';

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  ImagePlus,
  Loader2,
  SquareUser,
  Trash2,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import {
  CALL_BACKGROUND_UPLOAD_ACCEPT,
  CALL_BACKGROUND_UPLOAD_LIMIT,
} from './call-background-uploads';
import type {
  CallBackgroundUploads,
  CallBackgroundUploadView,
} from './use-call-background-uploads';
import { CallBlurIcon } from './call-blur-icon';
import {
  CALL_BACKGROUND_IMAGES,
  type CallBackgroundEffect,
  type CallBackgroundEffectStatus,
} from '@hypha-platform/core/client';

/** Background effect state and setter from `useSpaceGroupCall` (#2563). */
export type CallBackgroundEffectControl = {
  effect: CallBackgroundEffect;
  status: CallBackgroundEffectStatus;
  /** Processing too slow for the camera frame rate. */
  slow: boolean;
  /** False where the browser cannot run the effect; the control is not shown. */
  supported: boolean;
  onChange: (effect: CallBackgroundEffect) => void;
  /** The menu opened: draw the space background and preload the images for quick switching. */
  onMenuOpen: () => void;
  /** The call's space background once drawn (`blob:`), for the "This space" tile. */
  spaceImageSrc: string | null;
  /** The call's space logo, for the tile while its background is being drawn. */
  spaceLogoSrc: string | null;
  /** The member's own images on this device; null where not offered. */
  uploads: {
    available: boolean;
    items: CallBackgroundUploadView[] | null;
    busy: boolean;
    error: CallBackgroundUploads['error'];
    /** Stores and selects a picked file; resolves to whether it worked. */
    onAdd: (file: File) => Promise<boolean>;
    onRemove: (id: string) => void;
  } | null;
};

type BlurOption = {
  key: string;
  effect: CallBackgroundEffect;
  labelKey:
    | 'callBackgroundEffectNone'
    | 'callBackgroundEffectBlur'
    | 'callBackgroundEffectBlurStrong';
  icon: (className: string) => ReactNode;
};

const OPTIONS: BlurOption[] = [
  {
    key: 'none',
    effect: { kind: 'none' },
    labelKey: 'callBackgroundEffectNone',
    icon: (className) => <Ban className={className} />,
  },
  {
    key: 'blur-light',
    effect: { kind: 'blur', strength: 'light' },
    labelKey: 'callBackgroundEffectBlur',
    icon: (className) => <CallBlurIcon className={className} />,
  },
  {
    key: 'blur-strong',
    effect: { kind: 'blur', strength: 'strong' },
    labelKey: 'callBackgroundEffectBlurStrong',
    icon: (className) => <CallBlurIcon strong className={className} />,
  },
];

function isSameOption(a: CallBackgroundEffect, b: CallBackgroundEffect) {
  if (a.kind === 'blur' && b.kind === 'blur') {
    return (a.strength ?? 'light') === (b.strength ?? 'light');
  }
  return a.kind === b.kind;
}

/** Menu labels of the built-in images (`CALL_BACKGROUND_IMAGES` ids). */
const IMAGE_LABEL_KEYS: Record<
  string,
  'callBackgroundImageLight' | 'callBackgroundImageDark'
> = {
  light: 'callBackgroundImageLight',
  dark: 'callBackgroundImageDark',
};

const TILE_CLASS =
  'relative block aspect-video w-full overflow-hidden rounded-md border-2 transition-colors';
const tileBorder = (selected: boolean) =>
  selected
    ? 'border-[color:var(--color-accent-9,#4a65d8)]'
    : 'border-transparent hover:border-neutral-7';

function TileSpinner() {
  return (
    <span className="absolute inset-0 flex items-center justify-center bg-black/30">
      <Loader2 className="h-4 w-4 animate-spin text-white" aria-hidden />
    </span>
  );
}

/**
 * Menu content: heading, effect choices and the status line. Used by the toolbar menu and by the
 * More sub-view. Every choice closes the menu (`onDone`).
 */
export function CallBackgroundEffectMenuBody({
  control,
  isCameraOff,
  dark,
  backButton,
  onDone,
}: {
  control: CallBackgroundEffectControl;
  isCameraOff: boolean;
  dark: boolean;
  /** More menu sub-view: back arrow shown inline with the heading. */
  backButton?: ReactNode;
  /** Close the menu after a choice. */
  onDone: () => void;
}) {
  const t = useTranslations('HumanChatPanel');
  const hintClass = cn(
    'text-[11px] leading-snug',
    dark ? 'text-zinc-400' : 'text-muted-foreground',
  );
  const failed = control.status === 'failed';
  const applying = control.status === 'applying';
  const effectChosen = control.effect.kind !== 'none';
  const choose = (effect: CallBackgroundEffect, selected: boolean) => {
    if (!selected) control.onChange(effect);
    onDone();
  };
  const uploads = control.uploads;
  const uploadItems = uploads?.items ?? [];
  const uploadsFull = uploadItems.length >= CALL_BACKGROUND_UPLOAD_LIMIT;

  return (
    <>
      <div className="flex items-center gap-1">
        {backButton}
        <p
          className={cn(
            'py-1.5 text-sm font-semibold',
            backButton ? 'pr-2' : 'px-2',
          )}
        >
          {t('callBackgroundEffectLabel')}
        </p>
      </div>
      <div className="-mx-0 my-1 h-px bg-neutral-6" />
      {OPTIONS.map(({ key, effect, labelKey, icon }) => {
        const selected = isSameOption(control.effect, effect);
        return (
          <button
            key={key}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => choose(effect, selected)}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span className="inline-flex items-center gap-2">
              {icon('h-4 w-4')}
              {t(labelKey)}
            </span>
            {selected ? (
              applying ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <Check
                  className={cn(
                    'h-4 w-4',
                    dark ? 'text-white' : 'text-foreground',
                  )}
                />
              )
            ) : null}
          </button>
        );
      })}
      <p className={cn('px-2 pb-1 pt-2', hintClass)}>
        {t('callBackgroundEffectImages')}
      </p>
      <div className="grid grid-cols-2 gap-1.5 px-2" role="group">
        {CALL_BACKGROUND_IMAGES.map((image) => {
          const selected =
            control.effect.kind === 'image' &&
            control.effect.imageId === image.id;
          const labelKey = IMAGE_LABEL_KEYS[image.id];
          const label = labelKey ? t(labelKey) : image.id;
          return (
            <button
              key={image.id}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              onClick={() =>
                choose({ kind: 'image', imageId: image.id }, selected)
              }
              className={cn(TILE_CLASS, tileBorder(selected))}
            >
              <img
                src={image.thumbnailSrc}
                alt=""
                className="h-full w-full object-cover"
              />
              {selected && applying ? <TileSpinner /> : null}
            </button>
          );
        })}
        {(() => {
          const selected = control.effect.kind === 'space';
          const label = t('callBackgroundSpace');
          return (
            <button
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              aria-label={label}
              title={label}
              onClick={() => choose({ kind: 'space' }, selected)}
              className={cn(TILE_CLASS, tileBorder(selected))}
            >
              {control.spaceImageSrc ? (
                <img
                  src={control.spaceImageSrc}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                // Drawn when the menu opens; neutral placeholder for that moment.
                <span className="absolute inset-0 flex items-center justify-center bg-muted">
                  <Loader2
                    className="h-4 w-4 animate-spin opacity-60"
                    aria-hidden
                  />
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1 text-left text-[10px] leading-4 text-white">
                {label}
              </span>
              {selected && applying ? <TileSpinner /> : null}
            </button>
          );
        })()}
      </div>
      {uploads?.available ? (
        <>
          <p className={cn('px-2 pb-1 pt-2', hintClass)}>
            {t('callBackgroundUploadsLabel')} ({uploadItems.length}/
            {CALL_BACKGROUND_UPLOAD_LIMIT})
          </p>
          <div className="grid grid-cols-2 gap-1.5 px-2" role="group">
            {uploadItems.map((upload, index) => {
              const selected =
                control.effect.kind === 'upload' &&
                control.effect.uploadId === upload.id;
              const label = t('callBackgroundUploadNumber', {
                number: index + 1,
              });
              return (
                <div key={upload.id} className="relative">
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    aria-label={label}
                    onClick={() =>
                      choose({ kind: 'upload', uploadId: upload.id }, selected)
                    }
                    className={cn(TILE_CLASS, tileBorder(selected))}
                  >
                    <img
                      src={upload.thumbnailSrc}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {selected && applying ? <TileSpinner /> : null}
                  </button>
                  <button
                    type="button"
                    aria-label={t('callBackgroundUploadRemove')}
                    title={t('callBackgroundUploadRemove')}
                    onClick={() => uploads.onRemove(upload.id)}
                    className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <Trash2 className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              );
            })}
            {uploadsFull ? null : (
              <label
                className={cn(
                  'relative flex aspect-video cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-neutral-7 text-[11px] transition-colors hover:bg-muted/60',
                  uploads.busy && 'pointer-events-none opacity-60',
                )}
                title={t('callBackgroundUploadAdd')}
              >
                {uploads.busy ? (
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                ) : (
                  <ImagePlus className="h-4 w-4" aria-hidden />
                )}
                <span>{t('callBackgroundUploadAdd')}</span>
                <input
                  type="file"
                  accept={CALL_BACKGROUND_UPLOAD_ACCEPT}
                  className="sr-only"
                  disabled={uploads.busy}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    event.target.value = '';
                    if (!file) return;
                    void uploads.onAdd(file).then((ok) => {
                      if (ok) onDone();
                    });
                  }}
                />
              </label>
            )}
          </div>
          {uploads.error ? (
            <p className={cn('px-2 pt-1', hintClass)} role="alert">
              {uploads.error === 'unsupported_type' ||
              uploads.error === 'decode_failed'
                ? t('callBackgroundUploadErrorType')
                : uploads.error === 'too_large'
                ? t('callBackgroundUploadErrorSize')
                : t('callBackgroundUploadErrorFailed')}
            </p>
          ) : null}
        </>
      ) : null}
      {applying ? (
        <p className={cn('px-2 pt-1', hintClass)} role="status">
          {t('callBackgroundEffectApplying')}
        </p>
      ) : failed ? (
        <p
          className={cn('flex items-start gap-1.5 px-2 pt-1', hintClass)}
          role="alert"
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" />
          {t('callBackgroundEffectFailedCameraOn')}
        </p>
      ) : control.slow && effectChosen && !isCameraOff ? (
        <p
          className={cn('flex items-start gap-1.5 px-2 pt-1', hintClass)}
          role="status"
        >
          <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" />
          {t('callBackgroundEffectSlow')}
        </p>
      ) : effectChosen && isCameraOff ? (
        <p className={cn('px-2 pt-1', hintClass)}>
          {t('callBackgroundEffectAppliesWhenCameraOn')}
        </p>
      ) : null}
    </>
  );
}

/** Trigger icon: spinner while starting, warning dot when failed or slow. */
export function CallBackgroundEffectTriggerIcon({
  control,
  iconClassName,
  strokeWidth,
}: {
  control: CallBackgroundEffectControl;
  iconClassName: string;
  strokeWidth: number;
}) {
  if (control.status === 'applying') {
    return (
      <Loader2
        className={cn(iconClassName, 'animate-spin')}
        strokeWidth={strokeWidth}
        aria-hidden
      />
    );
  }
  const warn = control.status === 'failed' || control.slow;
  return (
    <span className="relative inline-flex" aria-hidden>
      <SquareUser className={iconClassName} strokeWidth={strokeWidth} />
      {warn ? (
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-amber-500" />
      ) : null}
    </span>
  );
}

/** Builds the control from `useSpaceGroupCall` / `useGlobalCallDock` values. */
export function toCallBackgroundEffectControl(call: {
  backgroundEffect: CallBackgroundEffect;
  backgroundEffectStatus: CallBackgroundEffectStatus;
  backgroundEffectSlow: boolean;
  backgroundEffectSupported: boolean;
  setBackgroundEffect: (effect: CallBackgroundEffect) => Promise<void>;
  spaceBackgroundImage?: string | null;
  callSpaceLogoUrl?: string | null;
  backgroundUploads?: CallBackgroundUploads | null;
  onBackgroundMenuOpen?: () => void;
}): CallBackgroundEffectControl {
  const uploads = call.backgroundUploads ?? null;
  return {
    effect: call.backgroundEffect,
    status: call.backgroundEffectStatus,
    slow: call.backgroundEffectSlow,
    supported: call.backgroundEffectSupported,
    onChange: (effect) => {
      void call.setBackgroundEffect(effect);
    },
    onMenuOpen: () => call.onBackgroundMenuOpen?.(),
    spaceImageSrc: call.spaceBackgroundImage ?? null,
    spaceLogoSrc: call.callSpaceLogoUrl ?? null,
    uploads: uploads
      ? {
          available: uploads.available,
          items: uploads.uploads,
          busy: uploads.busy,
          error: uploads.error,
          onAdd: async (file) => {
            const id = await uploads.add(file);
            if (!id) return false;
            void call.setBackgroundEffect({ kind: 'upload', uploadId: id });
            return true;
          },
          onRemove: (id) => {
            void uploads.remove(id);
          },
        }
      : null,
  };
}
