'use client';

import type { ReactNode } from 'react';
import { AlertTriangle, Ban, Check, Loader2, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import type {
  CallBackgroundEffect,
  CallBackgroundEffectStatus,
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
}): CallBackgroundEffectControl {
  return {
    effect: call.backgroundEffect,
    status: call.backgroundEffectStatus,
    slow: call.backgroundEffectSlow,
    supported: call.backgroundEffectSupported,
    onChange: (effect) => {
      void call.setBackgroundEffect(effect);
    },
  };
}
