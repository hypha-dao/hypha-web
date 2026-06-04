'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AudioLines,
  Check,
  ChevronUp,
  Circle,
  Disc,
  FileText,
  Mic,
  MicOff,
  MicVocal,
  Music2,
  Pause,
  Play,
  SlidersHorizontal,
  Square,
  Video,
  VideoOff,
} from 'lucide-react';
import { CallHangUpIcon } from './call-hang-up-icon';
import { useTranslations } from 'next-intl';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  useIsMobile,
  usePrefersCoarsePointer,
} from '@hypha-platform/ui';
import { cn } from '@hypha-platform/ui-utils';
import {
  getCallControlsPhase,
  type CallRecordingCaptureWarning,
  type SpaceGroupCallCaptureMode,
  type SpaceGroupCallRecordingStatus,
  type SpaceGroupCallState,
} from '@hypha-platform/core/client';
import { HumanChatPanelCallReactPopover } from './human-chat-panel-call-react-popover';
import type { CallFloatingReactionStyle } from './call-zoom-reaction-catalog';
import { HumanChatPanelCallScreenshareMenu } from './human-chat-panel-call-screenshare-menu';
import {
  callAccentAlertActionButtonClassName,
  callAccentAlertText,
} from './call-accent-alert-styles';

type HumanChatPanelInCallControlsProps = {
  callState: SpaceGroupCallState;
  isMicrophoneMuted: boolean;
  isLocalVideoMuted: boolean;
  isScreensharing: boolean;
  remoteScreenshareActive?: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onStartScreenshare: () => void;
  onStopScreenshare: () => void;
  voiceProcessingPreset: 'standard' | 'voice_isolation' | 'music';
  onVoiceProcessingPresetChange: (
    preset: 'standard' | 'voice_isolation' | 'music',
  ) => void;
  /** True when auto voice isolation is active during screen share (WCUX-SHARE-VOICE-5). */
  presenterVoiceBoostActive?: boolean;
  captureMode: SpaceGroupCallCaptureMode;
  capturePreference: Exclude<SpaceGroupCallCaptureMode, 'none'>;
  capturePreferenceSelected: boolean;
  onCapturePreferenceChange: (
    mode: Exclude<SpaceGroupCallCaptureMode, 'none'>,
  ) => void;
  onStartCapture: (mode?: Exclude<SpaceGroupCallCaptureMode, 'none'>) => void;
  onPauseCapture: () => void;
  onResumeCapture: () => void;
  onStopCapture: () => void;
  recordingStatus: SpaceGroupCallRecordingStatus;
  recordingError: string | null;
  recordingWarning?: CallRecordingCaptureWarning | null;
  canRetryRecordingUpload?: boolean;
  onRetryRecordingUpload?: () => void;
  onLeave: () => void;
  /** In header strip: compact buttons; in full view: larger, high-contrast on video. */
  variant?: 'inBanner' | 'fullView';
  /** Compact row alignment for dock/banner usage. */
  inBannerLayout?: 'inline' | 'balanced' | 'centered';
  /** Tighter controls for Document Picture-in-Picture floating window. */
  density?: 'default' | 'compact' | 'pip';
  /** Leave-only mode for in-chat convenience controls. */
  controlsMode?: 'full' | 'leave_only';
  canSendCallReactions?: boolean;
  localHandRaised?: boolean;
  onSendReaction?: (
    emoji: string,
    style?: CallFloatingReactionStyle,
  ) => void | Promise<void>;
  onToggleRaiseHand?: () => void | Promise<void>;
  /** Sidebar leave-only chrome on mobile still exposes reactions (WCUX-REACT-4). */
  includeReactionsWhenLeaveOnly?: boolean;
};

/**
 * Mute, camera, screen share, and leave — shared by {@link HumanChatPanelCallBanner}
 * and the full-view dialog (§3.4.4).
 */
export function HumanChatPanelInCallControls({
  callState,
  isMicrophoneMuted,
  isLocalVideoMuted,
  isScreensharing,
  remoteScreenshareActive = false,
  onToggleMic,
  onToggleCamera,
  onStartScreenshare,
  onStopScreenshare,
  voiceProcessingPreset,
  onVoiceProcessingPresetChange,
  presenterVoiceBoostActive = false,
  captureMode,
  capturePreference,
  capturePreferenceSelected,
  onCapturePreferenceChange,
  onStartCapture,
  onPauseCapture,
  onResumeCapture,
  onStopCapture,
  recordingStatus,
  recordingError,
  recordingWarning = null,
  canRetryRecordingUpload = false,
  onRetryRecordingUpload,
  onLeave,
  variant = 'inBanner',
  inBannerLayout = 'inline',
  density = 'default',
  controlsMode = 'full',
  canSendCallReactions = false,
  localHandRaised = false,
  onSendReaction,
  onToggleRaiseHand,
  includeReactionsWhenLeaveOnly = false,
}: HumanChatPanelInCallControlsProps) {
  const t = useTranslations('HumanChatPanel');
  const isMobile = useIsMobile() ?? false;
  const prefersCoarsePointer = usePrefersCoarsePointer() ?? false;
  const isTouchToolbar = isMobile || prefersCoarsePointer;
  const bannerCircleSize = isTouchToolbar ? 'h-11 w-11' : 'h-8 w-8';
  const bannerBarHeight = isTouchToolbar ? 'h-11' : 'h-8';
  const showAdvancedCallControls = !isMobile;
  const { controlsDisabled } = getCallControlsPhase(callState);
  const isCompact = density === 'compact' || density === 'pip';
  const isPipDensity = density === 'pip';
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const audioMenuRef = useRef<HTMLDivElement | null>(null);
  const [isCaptureMenuOpen, setIsCaptureMenuOpen] = useState(false);
  const captureMenuRef = useRef<HTMLDivElement | null>(null);
  const [stopConfirmStep, setStopConfirmStep] = useState<
    'none' | 'recording' | 'transcript'
  >('none');
  const isFull = variant === 'fullView';
  const isCenteredInBanner =
    !isFull && !isCompact && inBannerLayout === 'centered';
  const useMobileCenteredToolbar = isMobile && isCenteredInBanner;
  /**
   * Full view modal: §3.4.4.4 — white glyphs on dark / green / red (not
   * `text-foreground` on near-black / green where Lucide would read as black).
   */
  /** Explicit px — project `--spacing-7` is 40px; grid stretch ignores nominal Tailwind sizes. */
  const pipToolbarBtn =
    'box-border h-[28px] w-[28px] min-h-[28px] min-w-[28px] max-h-[28px] max-w-[28px] shrink-0 flex-none p-0';
  const fullViewControlSize = isPipDensity
    ? pipToolbarBtn
    : 'h-10 min-w-10 max-w-11 sm:h-11 sm:min-w-11';
  const fullViewIcon = isPipDensity
    ? 'h-3.5 w-3.5 text-white stroke-white'
    : 'h-5 w-5 text-white stroke-white';
  const compactBtn = isPipDensity
    ? 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring'
    : 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';
  const baseBtn = isFull
    ? cn(
        fullViewControlSize,
        'inline-flex items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/90 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-zinc-800/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        !isPipDensity && 'px-2.5',
      )
    : isCompact
    ? compactBtn
    : cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring',
        bannerCircleSize,
      );
  const neutralBtn = isFull
    ? baseBtn
    : isCompact
    ? compactBtn
    : cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring',
        bannerCircleSize,
      );
  const leaveIcon = isFull
    ? fullViewIcon
    : isPipDensity
    ? 'h-2.5 w-2.5'
    : isCompact
    ? 'h-3 w-3'
    : 'h-4 w-4';
  /**
   * End call — classic “hang up” red (explicit red-600/700, not `destructive` token
   * which can read as salmon in dark UIs on video chrome).
   */
  const leaveBtn = isFull
    ? cn(
        fullViewControlSize,
        'inline-flex items-center justify-center rounded-full border border-red-800/25 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/50 disabled:opacity-50',
      )
    : isPipDensity
    ? 'inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-red-800/30 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/40'
    : isCompact
    ? 'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-red-800/30 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/40'
    : cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-red-800/30 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/40',
        bannerCircleSize,
      );
  const micMutedBtn = isFull
    ? cn(baseBtn, 'border-rose-500/50 bg-rose-900/50 hover:bg-rose-900/70')
    : isCompact
    ? cn(
        compactBtn,
        'border-destructive/30 bg-destructive/12 text-destructive hover:bg-destructive/20',
      )
    : cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/20',
        bannerCircleSize,
      );
  const shareActiveBtn = isFull
    ? cn(
        baseBtn,
        isPipDensity
          ? 'border-emerald-500/60 bg-emerald-600/90 ring-1 ring-inset ring-emerald-400/35 hover:bg-emerald-500/90'
          : 'ring-2 ring-white/25 border-emerald-500/60 bg-emerald-600/90 hover:bg-emerald-500/90',
      )
    : isPipDensity
    ? cn(
        compactBtn,
        'border-emerald-500/55 bg-emerald-600/90 text-white ring-2 ring-emerald-500/25 hover:bg-emerald-500/90',
      )
    : isCompact
    ? cn(
        compactBtn,
        'border-emerald-500/55 bg-emerald-600/90 text-white ring-2 ring-emerald-500/25 hover:bg-emerald-500/90',
      )
    : cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-emerald-500/55 bg-emerald-600/90 text-white shadow-sm ring-2 ring-emerald-500/25 transition-colors hover:bg-emerald-500/90',
        bannerCircleSize,
      );
  /** Share is neutral until local screenshare is active; green matches “presenting” state. */
  const shareIdleBtn = neutralBtn;
  const camOffBtn = isFull
    ? cn(baseBtn, 'border-rose-500/50 bg-rose-900/50 hover:bg-rose-900/70')
    : isCompact
    ? cn(
        compactBtn,
        'border-destructive/30 bg-destructive/12 text-destructive hover:bg-destructive/20',
      )
    : cn(
        'inline-flex shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/20',
        bannerCircleSize,
      );
  const icon = isFull
    ? fullViewIcon
    : isPipDensity
    ? 'h-2.5 w-2.5'
    : isCompact
    ? 'h-3.5 w-3.5'
    : 'h-4 w-4';
  /** Production in-banner toolbar uses lighter Lucide strokes than full-view chrome. */
  const lucideStroke = isFull ? 2 : 1.75;
  const menuChevronClass = (menuOpen: boolean) =>
    cn(
      isFull ? 'h-4 w-4 text-white' : 'h-3.5 w-3.5',
      'shrink-0 opacity-70 transition-transform duration-200',
      menuOpen && 'rotate-180',
    );
  const audioSettingsBtn = isFull
    ? cn(
        fullViewControlSize,
        'inline-flex items-center justify-center gap-1 rounded-full border border-zinc-600/80 bg-zinc-900/90 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-zinc-800/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50',
        isPipDensity ? 'px-1.5' : 'px-2.5',
      )
    : isCompact
    ? isPipDensity
      ? 'inline-flex h-5 shrink-0 items-center justify-center gap-0.5 rounded-full border border-border/60 bg-background px-1 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring'
      : 'inline-flex h-7 shrink-0 items-center justify-center gap-0.5 rounded-full border border-border/60 bg-background px-1.5 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring'
    : cn(
        'inline-flex shrink-0 items-center justify-center gap-1 rounded-full border border-border/60 bg-background px-2 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring',
        bannerBarHeight,
      );
  const menuCheckIcon = isFull
    ? 'h-4 w-4 text-white'
    : 'h-4 w-4 text-foreground';
  const useSideAudioSettings =
    showAdvancedCallControls &&
    !isCompact &&
    !isFull &&
    (inBannerLayout === 'balanced' || inBannerLayout === 'centered');
  const leaveOnly = controlsMode === 'leave_only';
  const useWideToolbar = useMobileCenteredToolbar || useSideAudioSettings;
  const toolbarButtonGap = isPipDensity
    ? 'gap-1'
    : isCenteredInBanner
    ? 'gap-2.5 sm:gap-3'
    : isCompact
    ? 'gap-1'
    : 'gap-1.5 sm:gap-2';
  const captureActive = captureMode !== 'none' && recordingStatus !== 'error';
  const capturePending =
    captureActive && recordingStatus === 'idle' && !controlsDisabled;
  const captureStatusText =
    recordingStatus === 'recording'
      ? t('callCaptureStatusCapturing')
      : recordingStatus === 'paused'
      ? t('callCaptureStatusPaused')
      : recordingStatus === 'uploading'
      ? t('callCaptureStatusSaving')
      : recordingStatus === 'error'
      ? t('callCaptureStatusError')
      : capturePending
      ? t('callCaptureStatusStarting')
      : t('callCaptureStatusIdle');
  const captureIconClass = isFull
    ? fullViewIcon
    : isPipDensity
    ? 'h-2.5 w-2.5'
    : isCompact
    ? 'h-3 w-3'
    : 'h-4 w-4';
  const captureIdleIconClass = cn(
    captureIconClass,
    isFull
      ? 'fill-none stroke-white/80 text-white/80'
      : 'fill-none stroke-muted-foreground text-muted-foreground',
  );
  const captureLive = captureActive;
  const capturePaused = recordingStatus === 'paused';
  const captureMenuActive = captureActive;
  const capturePulsing = recordingStatus === 'recording';
  const showCallReactions =
    canSendCallReactions &&
    Boolean(onSendReaction && onToggleRaiseHand) &&
    (!leaveOnly || includeReactionsWhenLeaveOnly);
  const captureSettingsBtn = cn(
    audioSettingsBtn,
    captureLive &&
      (isFull
        ? 'border-rose-500/50 bg-rose-950/80 text-white'
        : 'border-rose-500/45 bg-rose-500/10 text-rose-600'),
  );
  const renderCaptureOnAirIcon = (
    <span
      className={cn(
        'relative inline-flex items-center justify-center',
        isFull
          ? 'h-5 w-5'
          : isPipDensity
          ? 'h-3 w-3'
          : isCompact
          ? 'h-3.5 w-3.5'
          : 'h-4 w-4',
      )}
      aria-hidden
    >
      {capturePulsing || capturePending ? (
        <span
          className={cn(
            'absolute rounded-full animate-ping opacity-70',
            isFull ? 'h-2.5 w-2.5 bg-rose-400' : 'h-2 w-2 bg-rose-600',
          )}
        />
      ) : null}
      <Circle
        className={cn(
          'fill-none',
          isFull
            ? 'h-5 w-5 stroke-rose-400 text-rose-400'
            : 'h-4 w-4 stroke-rose-600 text-rose-600',
        )}
      />
      <span
        className={cn(
          'absolute rounded-full',
          isFull ? 'h-2.5 w-2.5 bg-rose-400' : 'h-2 w-2 bg-rose-600',
          capturePulsing && 'animate-pulse',
        )}
      />
    </span>
  );

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (!target) return;
      if (!audioMenuRef.current?.contains(target)) {
        setIsAudioMenuOpen(false);
      }
      if (!captureMenuRef.current?.contains(target)) {
        setIsCaptureMenuOpen(false);
      }
    };
    window.addEventListener('pointerdown', onPointerDown);
    return () => window.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    if (!isAudioMenuOpen && !isCaptureMenuOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsAudioMenuOpen(false);
        setIsCaptureMenuOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isAudioMenuOpen, isCaptureMenuOpen]);

  const selectVoicePreset = (
    preset: 'standard' | 'voice_isolation' | 'music',
  ) => {
    onVoiceProcessingPresetChange(preset);
    setIsAudioMenuOpen(false);
  };
  const selectCapturePreference = (
    mode: Exclude<SpaceGroupCallCaptureMode, 'none'>,
  ) => {
    onCapturePreferenceChange(mode);
    if (captureMode === 'none') {
      onStartCapture(mode);
    }
    setIsCaptureMenuOpen(false);
  };
  const captureStopLabel = t('callCaptureStop');
  const recordingWarningMessage = (() => {
    if (!recordingWarning) return null;
    switch (recordingWarning.code) {
      case 'duration_warn':
        return t('callCaptureLimitDurationWarn', {
          minutes: recordingWarning.remainingMinutes,
        });
      case 'duration_critical':
        return t('callCaptureLimitDurationCritical', {
          minutes: recordingWarning.remainingMinutes,
        });
      case 'size_warn':
        return t('callCaptureLimitSizeWarn', {
          sizeMb: recordingWarning.remainingSizeMb,
        });
      case 'size_critical':
        return t('callCaptureLimitSizeCritical', {
          sizeMb: recordingWarning.remainingSizeMb,
        });
      default:
        return null;
    }
  })();
  const captureStopReady = captureActive && recordingStatus !== 'uploading';
  const capturePauseReady =
    recordingStatus === 'recording' || recordingStatus === 'paused';
  const requestStopCapture = () => {
    if (!captureStopReady) return;
    setIsCaptureMenuOpen(false);
    if (captureMode === 'recording_with_transcript') {
      setStopConfirmStep('recording');
      return;
    }
    setStopConfirmStep('transcript');
  };
  const confirmStopCapture = () => {
    setStopConfirmStep('none');
    onStopCapture();
  };
  const captureModeLabel = !captureActive
    ? t('callCaptureStatusIdle')
    : capturePending
    ? t('callCaptureStatusStarting')
    : captureMode === 'transcript_only'
    ? t('callCaptureModeTranscriptOnly')
    : t('callCaptureModeRecordingWithTranscript');

  const renderAudioSettingsMenu = (
    <div className="relative" ref={audioMenuRef}>
      <button
        type="button"
        className={audioSettingsBtn}
        title={t('callVoiceProcessingLabel')}
        aria-label={t('callVoiceProcessingLabel')}
        aria-haspopup="menu"
        aria-expanded={isAudioMenuOpen}
        onClick={() => {
          setIsCaptureMenuOpen(false);
          setIsAudioMenuOpen((open) => !open);
        }}
      >
        <SlidersHorizontal className={icon} strokeWidth={lucideStroke} />
        <ChevronUp className={menuChevronClass(isAudioMenuOpen)} aria-hidden />
      </button>
      {isAudioMenuOpen ? (
        <div
          role="menu"
          className={cn(
            'absolute bottom-full right-0 z-[60] mb-2 min-w-52 rounded-xl border bg-popover px-2 py-2 text-popover-foreground shadow-xl',
            isFull && 'border-zinc-700 bg-zinc-900 text-white',
          )}
        >
          <p className="px-2 py-1.5 text-sm font-semibold">
            {t('callVoiceProcessingLabel')}
          </p>
          {presenterVoiceBoostActive ? (
            <p
              className={cn(
                'px-2 pb-1.5 text-[11px] leading-snug',
                isFull ? 'text-zinc-400' : 'text-muted-foreground',
              )}
            >
              {t('callVoiceBoostWhilePresenting')}
            </p>
          ) : null}
          <div className="-mx-0 my-1 h-px bg-neutral-6" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={voiceProcessingPreset === 'standard'}
            onClick={() => selectVoicePreset('standard')}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span className="inline-flex items-center gap-2">
              <AudioLines className="h-4 w-4" />
              {t('callVoiceProcessingStandard')}
            </span>
            {voiceProcessingPreset === 'standard' ? (
              <Check className={menuCheckIcon} />
            ) : null}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={voiceProcessingPreset === 'voice_isolation'}
            onClick={() => selectVoicePreset('voice_isolation')}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span className="inline-flex items-center gap-2">
              <MicVocal className="h-4 w-4" />
              {t('callVoiceProcessingIsolation')}
            </span>
            {voiceProcessingPreset === 'voice_isolation' ? (
              <Check className={menuCheckIcon} />
            ) : null}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={voiceProcessingPreset === 'music'}
            onClick={() => selectVoicePreset('music')}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span className="inline-flex items-center gap-2">
              <Music2 className="h-4 w-4" />
              {t('callVoiceProcessingMusic')}
            </span>
            {voiceProcessingPreset === 'music' ? (
              <Check className={menuCheckIcon} />
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );
  const renderCaptureMenu = (
    <div className="relative" ref={captureMenuRef}>
      <button
        type="button"
        className={captureSettingsBtn}
        disabled={controlsDisabled}
        title={`${t(
          'callCaptureLabel',
        )}: ${captureModeLabel} - ${captureStatusText}`}
        aria-label={`${t('callCaptureLabel')}: ${captureModeLabel}`}
        aria-haspopup="menu"
        aria-expanded={isCaptureMenuOpen}
        onClick={() => {
          setIsAudioMenuOpen(false);
          setIsCaptureMenuOpen((open) => !open);
        }}
      >
        {captureLive ? (
          capturePaused ? (
            <Pause
              className={cn(
                captureIconClass,
                isFull ? 'text-rose-400' : 'text-rose-600 dark:text-rose-400',
              )}
              strokeWidth={lucideStroke}
              aria-hidden
            />
          ) : (
            renderCaptureOnAirIcon
          )
        ) : (
          <Disc className={captureIdleIconClass} />
        )}
        <ChevronUp
          className={menuChevronClass(isCaptureMenuOpen)}
          aria-hidden
        />
      </button>
      {isCaptureMenuOpen ? (
        <div
          role="menu"
          onPointerDown={(event) => event.stopPropagation()}
          className={cn(
            'absolute bottom-full right-0 z-[70] mb-2 min-w-52 rounded-xl border bg-popover px-2 py-2 text-popover-foreground shadow-xl',
            isFull && 'border-zinc-700 bg-zinc-900 text-white',
          )}
        >
          <p className="px-2 py-1.5 text-sm font-semibold">
            {t('callCaptureLabel')}
          </p>
          <div className="-mx-0 my-1 h-px bg-neutral-6" />
          {captureMenuActive ? (
            <>
              <button
                type="button"
                role="menuitem"
                disabled={!capturePauseReady}
                onClick={() => {
                  if (!capturePauseReady) return;
                  if (recordingStatus === 'paused') {
                    onResumeCapture();
                  } else {
                    onPauseCapture();
                  }
                  setIsCaptureMenuOpen(false);
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2">
                  {recordingStatus === 'paused' ? (
                    <Play className="h-4 w-4" />
                  ) : (
                    <Pause className="h-4 w-4" />
                  )}
                  {recordingStatus === 'paused'
                    ? t('callCaptureResume')
                    : t('callCapturePause')}
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!captureStopReady}
                onClick={requestStopCapture}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="inline-flex items-center gap-2 text-rose-500">
                  <Square className="h-4 w-4 fill-current" />
                  {captureStopLabel}
                </span>
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={
                  capturePreferenceSelected &&
                  capturePreference === 'transcript_only'
                }
                onClick={() => selectCapturePreference('transcript_only')}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
              >
                <span className="inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  {t('callCaptureModeTranscriptOnly')}
                </span>
                {capturePreferenceSelected &&
                capturePreference === 'transcript_only' ? (
                  <Check className={menuCheckIcon} />
                ) : null}
              </button>
              <button
                type="button"
                role="menuitemradio"
                aria-checked={
                  capturePreferenceSelected &&
                  capturePreference === 'recording_with_transcript'
                }
                onMouseDown={(event) => {
                  event.preventDefault();
                  selectCapturePreference('recording_with_transcript');
                }}
                className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
              >
                <span className="inline-flex items-center gap-2">
                  <Disc className="h-4 w-4 text-rose-600 fill-rose-600 stroke-rose-600" />
                  {t('callCaptureModeRecordingWithTranscript')}
                </span>
                {capturePreferenceSelected &&
                capturePreference === 'recording_with_transcript' ? (
                  <Check className={menuCheckIcon} />
                ) : null}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
  return (
    <>
      <AlertDialog
        open={stopConfirmStep === 'recording'}
        onOpenChange={(open) => {
          if (!open) setStopConfirmStep('none');
        }}
      >
        <AlertDialogContent
          viewport="full"
          overlayClassName="bg-black/75 backdrop-blur-sm supports-[backdrop-filter]:bg-black/65"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('callCaptureConfirmStopRecordingTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('callCaptureConfirmStopRecording')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('callCaptureConfirmCancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              colorVariant="accent"
              onClick={confirmStopCapture}
            >
              {t('callCaptureConfirmStopRecordingAction')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog
        open={stopConfirmStep === 'transcript'}
        onOpenChange={(open) => {
          if (!open) setStopConfirmStep('none');
        }}
      >
        <AlertDialogContent
          viewport="full"
          overlayClassName="bg-black/75 backdrop-blur-sm supports-[backdrop-filter]:bg-black/65"
        >
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t('callCaptureConfirmStopTranscriptTitle')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('callCaptureConfirmStopTranscript')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {t('callCaptureConfirmCancel')}
            </AlertDialogCancel>
            <Button
              type="button"
              colorVariant="accent"
              onClick={confirmStopCapture}
            >
              {t('callCaptureConfirmStopTranscriptAction')}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <div
        role="group"
        aria-label={t('callToolbarLabel')}
        className={cn(
          (useWideToolbar || isPipDensity) && 'w-full',
          'touch-manipulation',
        )}
        data-call-pip-toolbar={isPipDensity ? '' : undefined}
        onPointerDown={(event) => {
          event.stopPropagation();
        }}
      >
        <div
          className={cn(
            isFull
              ? 'flex w-full items-center justify-center'
              : useMobileCenteredToolbar
              ? 'flex w-full items-center justify-center gap-2.5'
              : isPipDensity
              ? 'flex w-full items-center justify-center gap-1'
              : useSideAudioSettings
              ? 'grid w-full grid-cols-[1fr_auto_1fr] items-center'
              : 'flex w-auto items-center',
          )}
        >
          {!useMobileCenteredToolbar &&
          useSideAudioSettings &&
          !isPipDensity ? (
            <div />
          ) : null}
          <div
            className={cn(
              'flex items-center',
              toolbarButtonGap,
              (isFull || useMobileCenteredToolbar || useSideAudioSettings) &&
                'justify-center',
            )}
          >
            {!leaveOnly ? (
              <>
                <button
                  type="button"
                  onClick={onToggleMic}
                  disabled={controlsDisabled}
                  className={cn(
                    isFull
                      ? isMicrophoneMuted
                        ? micMutedBtn
                        : baseBtn
                      : isMicrophoneMuted
                      ? micMutedBtn
                      : neutralBtn,
                    (isFull || isMicrophoneMuted) &&
                      'inline-flex items-center justify-center',
                    'disabled:cursor-not-allowed',
                    !isFull && controlsDisabled && 'opacity-50',
                  )}
                  title={t('callControlsMicrophone')}
                  aria-label={
                    isMicrophoneMuted
                      ? t('callControlsMicrophoneMutedAria')
                      : t('callControlsMicrophoneUnmutedAria')
                  }
                >
                  {isMicrophoneMuted ? (
                    <MicOff className={icon} strokeWidth={lucideStroke} />
                  ) : (
                    <Mic className={icon} strokeWidth={lucideStroke} />
                  )}
                </button>
                <button
                  type="button"
                  onClick={onToggleCamera}
                  disabled={controlsDisabled}
                  className={cn(
                    isFull
                      ? isLocalVideoMuted
                        ? camOffBtn
                        : baseBtn
                      : isLocalVideoMuted
                      ? camOffBtn
                      : neutralBtn,
                    (isFull || isLocalVideoMuted) &&
                      'inline-flex items-center justify-center',
                    'disabled:cursor-not-allowed',
                    !isFull && controlsDisabled && 'opacity-50',
                  )}
                  title={t('callControlsCamera')}
                  aria-label={
                    isLocalVideoMuted
                      ? t('callControlsCameraOffAria')
                      : t('callControlsCameraOnAria')
                  }
                >
                  {isLocalVideoMuted ? (
                    <VideoOff className={icon} strokeWidth={lucideStroke} />
                  ) : (
                    <Video className={icon} strokeWidth={lucideStroke} />
                  )}
                </button>
                {showAdvancedCallControls ? (
                  <HumanChatPanelCallScreenshareMenu
                    isScreensharing={isScreensharing}
                    disabled={controlsDisabled}
                    remoteScreenshareActive={remoteScreenshareActive}
                    onStartScreenshare={onStartScreenshare}
                    onStopScreenshare={onStopScreenshare}
                    triggerClassName={cn(
                      isScreensharing ? shareActiveBtn : shareIdleBtn,
                      'inline-flex items-center justify-center',
                      'disabled:cursor-not-allowed',
                      !isFull && controlsDisabled && 'opacity-50',
                    )}
                    activeTriggerClassName="inline-flex items-center justify-center"
                    iconClassName={icon}
                    iconStrokeWidth={lucideStroke}
                  />
                ) : null}
                {showCallReactions ? (
                  <HumanChatPanelCallReactPopover
                    disabled={controlsDisabled}
                    localHandRaised={localHandRaised}
                    onSendReaction={(emoji, style) => {
                      void onSendReaction?.(emoji, style);
                    }}
                    onToggleRaiseHand={() => {
                      void onToggleRaiseHand?.();
                    }}
                    variant={variant}
                    density={density}
                    iconStrokeWidth={lucideStroke}
                  />
                ) : null}
                {!leaveOnly &&
                showAdvancedCallControls &&
                !useSideAudioSettings &&
                !isPipDensity
                  ? renderCaptureMenu
                  : null}
                {!leaveOnly &&
                showAdvancedCallControls &&
                !useSideAudioSettings &&
                !isPipDensity
                  ? renderAudioSettingsMenu
                  : null}
              </>
            ) : null}
            {leaveOnly && showCallReactions ? (
              <HumanChatPanelCallReactPopover
                disabled={controlsDisabled}
                localHandRaised={localHandRaised}
                onSendReaction={(emoji, style) => {
                  void onSendReaction?.(emoji, style);
                }}
                onToggleRaiseHand={() => {
                  void onToggleRaiseHand?.();
                }}
                variant={variant}
                density={density}
                iconStrokeWidth={lucideStroke}
              />
            ) : null}
            <button
              type="button"
              onClick={onLeave}
              disabled={callState === 'disconnecting'}
              className={cn(
                leaveBtn,
                'disabled:cursor-not-allowed',
                callState === 'disconnecting' && 'opacity-50',
              )}
              title={t('callLeave')}
              aria-label={t('callLeave')}
            >
              <CallHangUpIcon
                className={leaveIcon}
                strokeWidth={lucideStroke}
              />
            </button>
          </div>
          {useSideAudioSettings &&
          !leaveOnly &&
          showAdvancedCallControls &&
          !isPipDensity ? (
            <div
              className={cn(
                'flex shrink-0 items-center gap-2',
                useSideAudioSettings && 'justify-self-end',
              )}
            >
              {renderCaptureMenu}
              {renderAudioSettingsMenu}
            </div>
          ) : null}
        </div>
        {!isPipDensity &&
        !isCompact &&
        showAdvancedCallControls &&
        recordingStatus === 'uploading' ? (
          <p className={cn('mt-1 text-[11px] text-muted-foreground')}>
            {t('callCaptureStatusSaving')}
          </p>
        ) : !isPipDensity &&
          showAdvancedCallControls &&
          recordingWarningMessage ? (
          <p
            className={cn(
              'mt-1 text-[11px]',
              recordingWarning?.code.endsWith('_critical')
                ? callAccentAlertText
                : 'text-muted-foreground',
            )}
          >
            {recordingWarningMessage}
          </p>
        ) : !isPipDensity &&
          showAdvancedCallControls &&
          recordingStatus === 'error' &&
          recordingError?.trim() ? (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className={cn('text-[11px]', callAccentAlertText)}>
              {recordingError}
            </p>
            {canRetryRecordingUpload && onRetryRecordingUpload ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn(
                  'h-6 px-2 text-[10px]',
                  callAccentAlertActionButtonClassName,
                )}
                onClick={() => void onRetryRecordingUpload()}
              >
                {t('callCaptureRetryUpload')}
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
