'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AppWindow,
  Check,
  ChevronDown,
  Monitor,
  MonitorOff,
  SquareStack,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CallScreenshareSurfaceMode } from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';

type HumanChatPanelCallScreenshareMenuProps = {
  isScreensharing: boolean;
  disabled?: boolean;
  /** Another participant is presenting — only one share at a time. */
  remoteScreenshareActive?: boolean;
  onStartScreenshare: (mode: CallScreenshareSurfaceMode) => void;
  onStopScreenshare: () => void;
  triggerClassName?: string;
  iconClassName?: string;
  iconStrokeWidth?: number;
  chevronClassName?: string;
  menuClassName?: string;
  activeTriggerClassName?: string;
  title?: string;
  activeAriaLabel?: string;
  inactiveAriaLabel?: string;
};

const SHARE_MODES: CallScreenshareSurfaceMode[] = ['tab', 'window', 'monitor'];

export function HumanChatPanelCallScreenshareMenu({
  isScreensharing,
  disabled = false,
  remoteScreenshareActive = false,
  onStartScreenshare,
  onStopScreenshare,
  triggerClassName,
  iconClassName,
  iconStrokeWidth,
  chevronClassName,
  menuClassName,
  activeTriggerClassName,
  title,
  activeAriaLabel,
  inactiveAriaLabel,
}: HumanChatPanelCallScreenshareMenuProps) {
  const t = useTranslations('HumanChatPanel');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedMode, setSelectedMode] =
    useState<CallScreenshareSurfaceMode>('tab');
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isMenuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isMenuOpen]);

  useEffect(() => {
    if (isScreensharing) {
      setIsMenuOpen(false);
    }
  }, [isScreensharing]);

  const modeLabel = (mode: CallScreenshareSurfaceMode) => {
    switch (mode) {
      case 'tab':
        return t('callShareModeTab');
      case 'window':
        return t('callShareModeWindow');
      case 'monitor':
        return t('callShareModeScreen');
    }
  };

  const modeIcon = (mode: CallScreenshareSurfaceMode) => {
    switch (mode) {
      case 'tab':
        return AppWindow;
      case 'window':
        return SquareStack;
      case 'monitor':
        return Monitor;
    }
  };

  const selectMode = (mode: CallScreenshareSurfaceMode) => {
    if (shareStartDisabled) return;
    setSelectedMode(mode);
    setIsMenuOpen(false);
    onStartScreenshare(mode);
  };

  const shareStartDisabled =
    disabled || (remoteScreenshareActive && !isScreensharing);

  if (isScreensharing) {
    return (
      <button
        type="button"
        onClick={onStopScreenshare}
        disabled={disabled}
        className={cn(triggerClassName, activeTriggerClassName)}
        title={title ?? t('callControlsScreenshare')}
        aria-label={activeAriaLabel ?? t('callControlsScreenshareActiveAria')}
      >
        <MonitorOff className={iconClassName} strokeWidth={iconStrokeWidth} />
      </button>
    );
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        disabled={shareStartDisabled}
        aria-haspopup="menu"
        aria-expanded={isMenuOpen}
        className={cn(
          triggerClassName,
          'inline-flex items-center justify-center gap-0.5',
          shareStartDisabled && 'cursor-not-allowed opacity-50',
        )}
        title={
          remoteScreenshareActive && !isScreensharing
            ? t('callScreenshareBlockedRemoteActive')
            : title ?? t('callControlsScreenshare')
        }
        aria-label={
          inactiveAriaLabel ?? t('callControlsScreenshareInactiveAria')
        }
        onClick={() => {
          if (shareStartDisabled) return;
          setIsMenuOpen((open) => !open);
        }}
      >
        <Monitor className={iconClassName} strokeWidth={iconStrokeWidth} />
        <ChevronDown
          className={chevronClassName ?? iconClassName}
          strokeWidth={iconStrokeWidth}
        />
      </button>
      {isMenuOpen ? (
        <div
          role="menu"
          aria-label={t('callShareModeMenuLabel')}
          className={cn(
            'absolute bottom-full right-0 z-[140] mb-2 min-w-56 rounded-xl border bg-popover px-2 py-2 text-popover-foreground shadow-xl',
            menuClassName,
          )}
        >
          <p className="px-2 py-1.5 text-sm font-semibold">
            {t('callShareModeMenuLabel')}
          </p>
          <div className="-mx-0 my-1 h-px bg-neutral-6" />
          {SHARE_MODES.map((mode) => {
            const Icon = modeIcon(mode);
            return (
              <button
                key={mode}
                type="button"
                role="menuitemradio"
                aria-checked={selectedMode === mode}
                onClick={() => selectMode(mode)}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
              >
                <span className="inline-flex min-w-0 items-center gap-2">
                  <Icon
                    className="h-4 w-4 shrink-0"
                    strokeWidth={iconStrokeWidth}
                  />
                  <span className="min-w-0">{modeLabel(mode)}</span>
                </span>
                {selectedMode === mode ? (
                  <Check
                    className="h-4 w-4 shrink-0"
                    strokeWidth={iconStrokeWidth}
                  />
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
