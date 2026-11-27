'use client';

import type { ReactNode } from 'react';
import {
  AlertTriangle,
  Ban,
  Check,
  ImagePlus,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { CALL_BACKGROUND_UPLOAD_ACCEPT } from './call-background-uploads';
import type {
  CallBackgroundUploads,
  CallBackgroundUploadView,
} from './use-call-background-uploads';
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
  /** The call's space background once drawn (`blob:`), for the "This space" tile. */
  spaceImageSrc: string | null;
  /** The call's space logo, for the tile before the background is drawn. */
  spaceLogoSrc: string | null;
  /** The member's own images on this device; null where not offered. */
  uploads: {
    available: boolean;
    items: CallBackgroundUploadView[] | null;
    busy: boolean;
    error: CallBackgroundUploads['error'];
    /** Stores and selects a picked file. */
    onAdd: (file: File) => void;
    onRemove: (id: string) => void;
  } | null;
};

const OPTIONS: Array<{
  effect: CallBackgroundEffect;
  labelKey: 'callBackgroundEffectNone' | 'callBackgroundEffectBlur';
  Icon: typeof Ban;
}> = [
  { effect: { kind: 'none' }, labelKey: 'callBackgroundEffectNone', Icon: Ban },
  {
    effect: { kind: 'blur' },
    labelKey: 'callBackgroundEffectBlur',
    Icon: Sparkles,
  },
];

/** Menu labels of the built-in images (`CALL_BACKGROUND_IMAGES` ids). */
const IMAGE_LABEL_KEYS: Record<
  string,
  'callBackgroundImageLight' | 'callBackgroundImageDark'
> = {
  light: 'callBackgroundImageLight',
  dark: 'callBackgroundImageDark',
};

/**
 * Menu content: heading, effect choices and the status line. Used by the toolbar menu and by the
 * share toolbar's More sub-view.
 */
export function CallBackgroundEffectMenuBody({
  control,
  isCameraOff,
  dark,
  backButton,
  onTurnCameraOnWithoutEffect,
  onDone,
}: {
  control: CallBackgroundEffectControl;
  isCameraOff: boolean;
  dark: boolean;
  /** More menu sub-view: back arrow shown inline with the heading. */
  backButton?: ReactNode;
  onTurnCameraOnWithoutEffect: () => void;
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
      {OPTIONS.map(({ effect, labelKey, Icon }) => {
        const selected = control.effect.kind === effect.kind;
        return (
          <button
            key={effect.kind}
            type="button"
            role="menuitemradio"
            aria-checked={selected}
            onClick={() => {
              if (!selected) control.onChange(effect);
              onDone();
            }}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span className="inline-flex items-center gap-2">
              <Icon className="h-4 w-4" />
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
              onClick={() => {
                if (!selected)
                  control.onChange({ kind: 'image', imageId: image.id });
                onDone();
              }}
              className={cn(
                'relative aspect-video overflow-hidden rounded-md border-2 transition-colors',
                selected
                  ? 'border-[color:var(--color-accent-9,#4a65d8)]'
                  : 'border-transparent hover:border-neutral-7',
              )}
            >
              <img
                src={image.thumbnailSrc}
                alt=""
                loading="lazy"
                className="h-full w-full object-cover"
              />
              {selected && applying ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2
                    className="h-4 w-4 animate-spin text-white"
                    aria-hidden
                  />
                </span>
              ) : null}
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
              onClick={() => {
                if (!selected) control.onChange({ kind: 'space' });
                onDone();
              }}
              className={cn(
                'relative aspect-video overflow-hidden rounded-md border-2 transition-colors',
                selected
                  ? 'border-[color:var(--color-accent-9,#4a65d8)]'
                  : 'border-transparent hover:border-neutral-7',
              )}
            >
              {control.spaceImageSrc ? (
                <img
                  src={control.spaceImageSrc}
                  alt=""
                  className="h-full w-full object-cover"
                />
              ) : (
                <span
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(45deg, var(--space-accent-deep, #24433f), var(--space-accent, #3d6b66))',
                  }}
                >
                  {control.spaceLogoSrc ? (
                    <img
                      src={control.spaceLogoSrc}
                      alt=""
                      className="absolute right-[12%] top-[14%] h-[30%] w-auto rounded-sm bg-white/90"
                    />
                  ) : null}
                </span>
              )}
              <span className="absolute inset-x-0 bottom-0 truncate bg-black/45 px-1 text-left text-[10px] leading-4 text-white">
                {label}
              </span>
              {selected && applying ? (
                <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                  <Loader2
                    className="h-4 w-4 animate-spin text-white"
                    aria-hidden
                  />
                </span>
              ) : null}
            </button>
          );
        })()}
      </div>
      {control.uploads?.available ? (
        <>
          <p className={cn('px-2 pb-1 pt-2', hintClass)}>
            {t('callBackgroundUploadsLabel')}
          </p>
          <div className="grid grid-cols-2 gap-1.5 px-2" role="group">
            {(control.uploads.items ?? []).map((upload, index) => {
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
                    title={label}
                    onClick={() => {
                      if (!selected) {
                        control.onChange({
                          kind: 'upload',
                          uploadId: upload.id,
                        });
                      }
                      onDone();
                    }}
                    className={cn(
                      'relative block aspect-video w-full overflow-hidden rounded-md border-2 transition-colors',
                      selected
                        ? 'border-[color:var(--color-accent-9,#4a65d8)]'
                        : 'border-transparent hover:border-neutral-7',
                    )}
                  >
                    <img
                      src={upload.thumbnailSrc}
                      alt=""
                      className="h-full w-full object-cover"
                    />
                    {selected && applying ? (
                      <span className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Loader2
                          className="h-4 w-4 animate-spin text-white"
                          aria-hidden
                        />
                      </span>
                    ) : null}
                  </button>
                  <button
                    type="button"
                    aria-label={t('callBackgroundUploadRemove')}
                    title={t('callBackgroundUploadRemove')}
                    onClick={() => control.uploads?.onRemove(upload.id)}
                    className="absolute right-0.5 top-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white hover:bg-black/80"
                  >
                    <X className="h-3 w-3" aria-hidden />
                  </button>
                </div>
              );
            })}
            <label
              className={cn(
                'relative flex aspect-video cursor-pointer flex-col items-center justify-center gap-0.5 rounded-md border-2 border-dashed border-neutral-7 text-[11px] transition-colors hover:bg-muted/60',
                control.uploads.busy && 'pointer-events-none opacity-60',
              )}
              title={t('callBackgroundUploadAdd')}
            >
              {control.uploads.busy ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                <ImagePlus className="h-4 w-4" aria-hidden />
              )}
              <span>{t('callBackgroundUploadAdd')}</span>
              <input
                type="file"
                accept={CALL_BACKGROUND_UPLOAD_ACCEPT}
                className="sr-only"
                disabled={control.uploads.busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  event.target.value = '';
                  if (file) control.uploads?.onAdd(file);
                }}
              />
            </label>
          </div>
          <p className={cn('px-2 pt-1', hintClass)}>
            {control.uploads.error === 'unsupported_type' ||
            control.uploads.error === 'decode_failed'
              ? t('callBackgroundUploadErrorType')
              : control.uploads.error === 'too_large'
              ? t('callBackgroundUploadErrorSize')
              : control.uploads.error
              ? t('callBackgroundUploadErrorFailed')
              : t('callBackgroundUploadHint')}
          </p>
        </>
      ) : null}
      {applying ? (
        <p className={cn('px-2 pt-1', hintClass)} role="status">
          {t('callBackgroundEffectApplying')}
        </p>
      ) : failed ? (
        <div className="space-y-1 px-2 pt-1" role="alert">
          <p className={cn('flex items-start gap-1.5', hintClass)}>
            <AlertTriangle className="mt-px h-3.5 w-3.5 shrink-0 text-amber-500" />
            {isCameraOff
              ? t('callBackgroundEffectFailedCameraOff')
              : t('callBackgroundEffectFailedCameraOn')}
          </p>
          {isCameraOff ? (
            <button
              type="button"
              onClick={() => {
                onTurnCameraOnWithoutEffect();
                onDone();
              }}
              className="w-full rounded-lg px-2 py-1 text-left text-1 font-medium underline-offset-2 hover:underline"
            >
              {t('callBackgroundEffectTurnOnWithout')}
            </button>
          ) : null}
        </div>
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
      <Sparkles className={iconClassName} strokeWidth={strokeWidth} />
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
    spaceImageSrc: call.spaceBackgroundImage ?? null,
    spaceLogoSrc: call.callSpaceLogoUrl ?? null,
    uploads: uploads
      ? {
          available: uploads.available,
          items: uploads.uploads,
          busy: uploads.busy,
          error: uploads.error,
          onAdd: (file) => {
            void uploads.add(file).then((id) => {
              if (id) {
                void call.setBackgroundEffect({ kind: 'upload', uploadId: id });
              }
            });
          },
          onRemove: (id) => {
            void uploads.remove(id);
          },
        }
      : null,
  };
}
