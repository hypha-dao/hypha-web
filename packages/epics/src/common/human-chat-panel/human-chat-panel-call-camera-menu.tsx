'use client';

import type { ReactNode } from 'react';
import { Camera, Check, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type {
  CallCameraDevice,
  CallCameraDeviceNotice,
} from '@hypha-platform/core/client';

/** Camera choice from `useSpaceGroupCall` (#2789). */
export type CallCameraDeviceControl = {
  /** The cameras on this device; empty before camera permission (no ids yet). */
  devices: CallCameraDevice[];
  /** The camera in use, else the one the next camera-on uses; null = browser default. */
  selectedDeviceId: string | null;
  switching: boolean;
  onSelect: (deviceId: string) => void;
  /** The menu opened: re-read the cameras (one may have been plugged in). */
  onMenuOpen: () => void;
};

/** The picker's name for a camera; unnamed ones are numbered in list order. */
export function useCallCameraName() {
  const t = useTranslations('HumanChatPanel');
  return (devices: readonly CallCameraDevice[], deviceId: string | null) => {
    const index = devices.findIndex((camera) => camera.deviceId === deviceId);
    if (index < 0) return null;
    return (
      devices[index]!.label || t('callCameraUnnamed', { number: index + 1 })
    );
  };
}

/**
 * Camera list for the Settings menu and the More menus (#2789). Names only (callout 3); the
 * list shows a single camera too (callout 1), so members see which one the call uses.
 */
export function CallCameraMenuBody({
  control,
  dark,
  backButton,
  onDone,
}: {
  control: CallCameraDeviceControl;
  dark: boolean;
  /** Sub-view: back arrow shown inline with the heading. */
  backButton?: ReactNode;
  /** Close the menu after a choice. */
  onDone: () => void;
}) {
  const t = useTranslations('HumanChatPanel');
  const cameraName = useCallCameraName();
  const hintClass = cn(
    'px-2 py-1.5 text-[11px] leading-snug',
    dark ? 'text-zinc-400' : 'text-muted-foreground',
  );
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
          {t('callCameraLabel')}
        </p>
      </div>
      <div className="-mx-0 my-1 h-px bg-neutral-6" />
      {control.devices.length === 0 ? (
        <p className={hintClass}>{t('callCameraListEmpty')}</p>
      ) : (
        control.devices.map((camera) => {
          const selected = camera.deviceId === control.selectedDeviceId;
          return (
            <button
              key={camera.deviceId}
              type="button"
              role="menuitemradio"
              aria-checked={selected}
              disabled={control.switching}
              onClick={() => {
                if (!selected) control.onSelect(camera.deviceId);
                onDone();
              }}
              className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80 disabled:cursor-wait"
            >
              <span className="inline-flex min-w-0 items-center gap-2">
                <Camera className="h-4 w-4 shrink-0" aria-hidden />
                <span className="truncate">
                  {cameraName(control.devices, camera.deviceId)}
                </span>
              </span>
              {selected ? (
                control.switching ? (
                  <Loader2
                    className="h-4 w-4 shrink-0 animate-spin"
                    aria-label={t('callCameraSwitching')}
                  />
                ) : (
                  <Check
                    className={cn(
                      'h-4 w-4 shrink-0',
                      dark ? 'text-white' : 'text-foreground',
                    )}
                  />
                )
              ) : null}
            </button>
          );
        })
      )}
    </>
  );
}

/** The call-banner text for a camera notice (failed switch, unplugged camera). */
export function useCallCameraNoticeText() {
  const t = useTranslations('HumanChatPanel');
  return (notice: CallCameraDeviceNotice): string => {
    switch (notice.kind) {
      case 'switch_failed':
        return t('callCameraNoticeSwitchFailed', {
          camera: notice.label || t('callCameraNoticeSelectedCamera'),
        });
      case 'switch_failed_off':
        return t('callCameraNoticeSwitchFailedOff', {
          camera: notice.label || t('callCameraNoticeSelectedCamera'),
        });
      case 'disconnected_switched':
        return t('callCameraNoticeDisconnectedSwitched', {
          camera: notice.label || t('callCameraNoticeOtherCamera'),
        });
      case 'disconnected_off':
        return t('callCameraNoticeDisconnectedOff');
    }
  };
}

/** Builds the control from `useSpaceGroupCall` / `useGlobalCallDock` values. */
export function toCallCameraDeviceControl(call: {
  cameraDevices: CallCameraDevice[];
  selectedCameraDeviceId: string | null;
  cameraSwitching: boolean;
  setCameraDevice: (deviceId: string) => Promise<void>;
  refreshCameraDevices: () => Promise<unknown>;
}): CallCameraDeviceControl {
  return {
    devices: call.cameraDevices,
    selectedDeviceId: call.selectedCameraDeviceId,
    switching: call.cameraSwitching,
    onSelect: (deviceId) => {
      void call.setCameraDevice(deviceId);
    },
    onMenuOpen: () => {
      void call.refreshCameraDevices();
    },
  };
}
