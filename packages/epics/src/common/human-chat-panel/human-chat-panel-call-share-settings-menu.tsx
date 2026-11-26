'use client';

import { useEffect, useRef, useState } from 'react';
import { Settings2 } from 'lucide-react';
import { useTranslations } from 'next-intl';

import {
  SCREEN_SHARE_SETTING_CHOICES,
  setScreenSharePublishSettings,
  useScreenSharePublishSettings,
  type ScreenSharePublishSettings,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

type SettingKey = keyof ScreenSharePublishSettings;

const ROWS: ReadonlyArray<{ key: SettingKey; labelKey: string }> = [
  { key: 'maxSize', labelKey: 'callShareSettingsMaxSize' },
  { key: 'frameRate', labelKey: 'callShareSettingsFrameRate' },
  { key: 'bitrateMbps', labelKey: 'callShareSettingsBitrate' },
  { key: 'layers', labelKey: 'callShareSettingsLayers' },
  { key: 'codec', labelKey: 'callShareSettingsCodec' },
];

/**
 * Sharer-side screenshare settings (#2742): size, frame rate, bitrate, smaller copies and codec.
 * They are fixed when a share starts, so a change applies to the next share. Each row is a small
 * radio group; the values are technical on purpose while we compare them on a preview.
 */
export function HumanChatPanelCallShareSettingsMenu({
  isScreensharing,
  triggerClassName,
  iconClassName,
  iconStrokeWidth,
  pip = false,
  dark = false,
}: {
  isScreensharing: boolean;
  triggerClassName?: string;
  iconClassName?: string;
  iconStrokeWidth?: number;
  /** Document PiP density: the popover is fixed above the toolbar. */
  pip?: boolean;
  /** Full view (dark toolbar). */
  dark?: boolean;
}) {
  const t = useTranslations('HumanChatPanel');
  const settings = useScreenSharePublishSettings();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const doc = rootRef.current?.ownerDocument;
    if (!doc) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    doc.addEventListener('pointerdown', onPointerDown);
    doc.addEventListener('keydown', onKeyDown);
    return () => {
      doc.removeEventListener('pointerdown', onPointerDown);
      doc.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const valueLabel = (key: SettingKey, value: string | number): string => {
    if (key === 'maxSize' && value === 'native') {
      return t('callShareSettingsNative');
    }
    if (key === 'frameRate') return `${value} fps`;
    if (key === 'bitrateMbps') return `${value} Mbps`;
    if (key === 'layers') return value === '360p' ? '360p' : '360p + 720p';
    if (key === 'codec') {
      return value === 'h264' ? 'H.264' : String(value).toUpperCase();
    }
    return String(value);
  };

  const update = <K extends SettingKey>(
    key: K,
    value: ScreenSharePublishSettings[K],
  ) => setScreenSharePublishSettings({ ...settings, [key]: value });

  return (
    <div className="relative" ref={rootRef} data-call-interactive="true">
      <button
        ref={triggerRef}
        type="button"
        className={triggerClassName}
        title={t('callShareSettingsTitle')}
        aria-label={t('callShareSettingsTitle')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <Settings2 className={iconClassName} strokeWidth={iconStrokeWidth} />
      </button>
      {open ? (
        <div
          role="dialog"
          aria-label={t('callShareSettingsTitle')}
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            'z-[70] max-h-[min(70vh,calc(100dvh-8rem),var(--hypha-call-dock-popover-max-h,9999px))] overflow-y-auto rounded-xl border bg-popover px-3 py-2 text-popover-foreground shadow-xl',
            pip
              ? 'fixed bottom-14 left-1/2 w-[calc(100dvw-1rem)] max-w-72 -translate-x-1/2'
              : 'absolute bottom-full left-1/2 mb-2 w-72 -translate-x-1/2',
            dark && 'border-zinc-700 bg-zinc-900 text-white',
          )}
        >
          <p className="py-1 text-sm font-semibold">
            {t('callShareSettingsTitle')}
          </p>
          <p className="pb-2 text-xs opacity-70">
            {isScreensharing
              ? t('callShareSettingsNoteSharing')
              : t('callShareSettingsNote')}
          </p>
          {ROWS.map(({ key, labelKey }) => (
            <div key={key} className="py-1.5">
              <p
                className="pb-1 text-xs font-medium"
                id={`share-setting-${key}`}
              >
                {t(labelKey)}
              </p>
              <div
                role="radiogroup"
                aria-labelledby={`share-setting-${key}`}
                className="flex flex-wrap gap-1"
              >
                {(
                  SCREEN_SHARE_SETTING_CHOICES[key] as ReadonlyArray<
                    ScreenSharePublishSettings[typeof key]
                  >
                ).map((value) => {
                  const checked = settings[key] === value;
                  return (
                    <button
                      key={String(value)}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => update(key, value)}
                      className={cn(
                        'rounded-md border px-2 py-1 text-xs transition-colors',
                        checked
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border/60 hover:bg-muted/80',
                        dark && !checked && 'border-zinc-700 hover:bg-zinc-800',
                      )}
                    >
                      {valueLabel(key, value)}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
          {svcCodecNote(settings, t)}
          <button
            type="button"
            onClick={() => setScreenSharePublishSettings(null)}
            className="mt-1 w-full rounded-md px-2 py-1.5 text-left text-xs underline-offset-2 hover:underline"
          >
            {t('callShareSettingsReset')}
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** VP9 / AV1 build the smaller copies inside one stream, so the copies row does not apply. */
function svcCodecNote(
  settings: ScreenSharePublishSettings,
  t: (key: string) => string,
) {
  if (settings.codec !== 'vp9' && settings.codec !== 'av1') return null;
  return (
    <p className="pb-1 text-xs opacity-70">{t('callShareSettingsSvcNote')}</p>
  );
}
