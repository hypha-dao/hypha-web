'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Circle,
  Check,
  ChevronDown,
  FileText,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Square,
  Video,
  VideoOff,
  Volume2,
} from 'lucide-react';
import { CallHangUpIcon } from './call-hang-up-icon';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import {
  getCallControlsPhase,
  type SpaceGroupCallCaptureMode,
  type SpaceGroupCallRecordingStatus,
  type SpaceGroupCallState,
} from '@hypha-platform/core/client';

type HumanChatPanelInCallControlsProps = {
  callState: SpaceGroupCallState;
  isMicrophoneMuted: boolean;
  isLocalVideoMuted: boolean;
  isScreensharing: boolean;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenshare: () => void;
  voiceProcessingPreset: 'standard' | 'voice_isolation' | 'music';
  onVoiceProcessingPresetChange: (
    preset: 'standard' | 'voice_isolation' | 'music',
  ) => void;
  captureMode: SpaceGroupCallCaptureMode;
  onCaptureModeChange: (mode: SpaceGroupCallCaptureMode) => void;
  recordingStatus: SpaceGroupCallRecordingStatus;
  recordingError: string | null;
  onLeave: () => void;
  /** In header strip: compact buttons; in full view: larger, high-contrast on video. */
  variant?: 'inBanner' | 'fullView';
  /** Compact row alignment for dock/banner usage. */
  inBannerLayout?: 'inline' | 'balanced' | 'centered';
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
  onToggleMic,
  onToggleCamera,
  onToggleScreenshare,
  voiceProcessingPreset,
  onVoiceProcessingPresetChange,
  captureMode,
  onCaptureModeChange,
  recordingStatus,
  recordingError,
  onLeave,
  variant = 'inBanner',
  inBannerLayout = 'inline',
}: HumanChatPanelInCallControlsProps) {
  const t = useTranslations('HumanChatPanel');
  const { controlsDisabled } = getCallControlsPhase(callState);
  const [isAudioMenuOpen, setIsAudioMenuOpen] = useState(false);
  const audioMenuRef = useRef<HTMLDivElement | null>(null);
  const [isCaptureMenuOpen, setIsCaptureMenuOpen] = useState(false);
  const captureMenuRef = useRef<HTMLDivElement | null>(null);
  const leaveWarningTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [leaveWithoutCaptureArmed, setLeaveWithoutCaptureArmed] =
    useState(false);
  const isFull = variant === 'fullView';
  const isCenteredInBanner = !isFull && inBannerLayout === 'centered';
  /**
   * Full view modal: §3.4.4.4 — white glyphs on dark / green / red (not
   * `text-foreground` on near-black / green where Lucide would read as black).
   */
  const fullViewIcon = 'h-5 w-5 text-white stroke-white';
  const baseBtn = isFull
    ? 'h-10 min-w-10 sm:h-11 sm:min-w-11 inline-flex items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/90 px-2.5 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-zinc-800/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background/95 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';
  const neutralBtn = isFull
    ? baseBtn
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';
  const leaveIcon = isFull ? fullViewIcon : 'h-4 w-4';
  /**
   * End call — classic “hang up” red (explicit red-600/700, not `destructive` token
   * which can read as salmon in dark UIs on video chrome).
   */
  const leaveBtn = isFull
    ? 'inline-flex h-10 min-w-10 sm:h-11 sm:min-w-11 items-center justify-center rounded-full border border-red-800/25 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/50 disabled:opacity-50'
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-red-800/30 bg-red-600 text-white shadow-sm transition-colors hover:bg-red-700 focus-visible:outline focus-visible:ring-2 focus-visible:ring-red-500/40';
  const micMutedBtn = isFull
    ? cn(baseBtn, 'border-rose-500/50 bg-rose-900/50 hover:bg-rose-900/70')
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/20';
  const shareActiveBtn = isFull
    ? cn(
        baseBtn,
        'ring-2 ring-white/25 border-emerald-500/60 bg-emerald-600/90 hover:bg-emerald-500/90',
      )
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-emerald-500/55 bg-emerald-600/90 text-white shadow-sm ring-2 ring-emerald-500/25 transition-colors hover:bg-emerald-500/90';
  const camOffBtn = isFull
    ? cn(baseBtn, 'border-rose-500/50 bg-rose-900/50 hover:bg-rose-900/70')
    : 'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-destructive/30 bg-destructive/12 text-destructive shadow-sm hover:bg-destructive/20';
  const icon = isFull ? fullViewIcon : 'h-4 w-4';
  const audioSettingsBtn = isFull
    ? 'inline-flex h-10 min-w-10 sm:h-11 sm:min-w-11 items-center justify-center gap-1 rounded-full border border-zinc-600/80 bg-zinc-900/90 px-2.5 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-zinc-800/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
    : 'inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-full border border-border/60 bg-background px-2 text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';
  const menuCheckIcon = isFull
    ? 'h-4 w-4 text-white'
    : 'h-4 w-4 text-foreground';
  const useSideAudioSettings =
    isFull || inBannerLayout === 'balanced' || inBannerLayout === 'centered';
  const captureSettingsBtn = isFull
    ? 'relative inline-flex h-10 min-w-10 sm:h-11 sm:min-w-11 items-center justify-center rounded-full border border-zinc-600/80 bg-zinc-900/90 text-white shadow-sm backdrop-blur-sm transition-colors hover:bg-zinc-800/95 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50'
    : 'relative inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/60 bg-background text-foreground shadow-sm transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring';
  const captureStatusText =
    recordingStatus === 'recording'
      ? t('callCaptureStatusCapturing')
      : recordingStatus === 'uploading'
      ? t('callCaptureStatusSaving')
      : recordingStatus === 'error'
      ? t('callCaptureStatusError')
      : t('callCaptureStatusIdle');
  const captureIconClass = isFull ? fullViewIcon : 'h-4 w-4';
  const captureRecordingIconClass = cn(
    captureIconClass,
    isFull ? 'text-rose-400 stroke-rose-400' : 'text-rose-600 stroke-rose-600',
  );
  const captureStatusDotClass =
    recordingStatus === 'recording'
      ? 'bg-emerald-500'
      : recordingStatus === 'uploading'
      ? 'bg-amber-500'
      : recordingStatus === 'error'
      ? 'bg-destructive'
      : 'bg-muted-foreground/40';
  const captureOff = captureMode === 'none';

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

  useEffect(() => {
    if (!captureOff && leaveWithoutCaptureArmed) {
      setLeaveWithoutCaptureArmed(false);
    }
  }, [captureOff, leaveWithoutCaptureArmed]);

  useEffect(() => {
    return () => {
      if (leaveWarningTimeoutRef.current) {
        clearTimeout(leaveWarningTimeoutRef.current);
      }
    };
  }, []);

  const selectVoicePreset = (
    preset: 'standard' | 'voice_isolation' | 'music',
  ) => {
    onVoiceProcessingPresetChange(preset);
    setIsAudioMenuOpen(false);
  };
  const selectCaptureMode = (mode: SpaceGroupCallCaptureMode) => {
    onCaptureModeChange(mode);
    setIsCaptureMenuOpen(false);
  };
  const handleLeaveWithCaptureGuard = () => {
    if (!captureOff) {
      onLeave();
      return;
    }
    if (!leaveWithoutCaptureArmed) {
      setLeaveWithoutCaptureArmed(true);
      if (leaveWarningTimeoutRef.current) {
        clearTimeout(leaveWarningTimeoutRef.current);
      }
      leaveWarningTimeoutRef.current = setTimeout(() => {
        setLeaveWithoutCaptureArmed(false);
        leaveWarningTimeoutRef.current = null;
      }, 4000);
      return;
    }
    setLeaveWithoutCaptureArmed(false);
    if (leaveWarningTimeoutRef.current) {
      clearTimeout(leaveWarningTimeoutRef.current);
      leaveWarningTimeoutRef.current = null;
    }
    onLeave();
  };
  const captureModeLabel =
    captureMode === 'transcript_only'
      ? t('callCaptureModeTranscriptOnly')
      : captureMode === 'recording_with_transcript'
      ? t('callCaptureModeRecordingWithTranscript')
      : t('callCaptureModeNone');

  const renderAudioSettingsMenu = (
    <div className="relative" ref={audioMenuRef}>
      <button
        type="button"
        className={audioSettingsBtn}
        title={t('callVoiceProcessingLabel')}
        aria-label={t('callVoiceProcessingLabel')}
        aria-haspopup="menu"
        aria-expanded={isAudioMenuOpen}
        onClick={() => setIsAudioMenuOpen((open) => !open)}
      >
        <Volume2 className={icon} />
        <ChevronDown
          className={cn(isFull ? 'h-4 w-4 text-white' : 'h-3.5 w-3.5')}
        />
      </button>
      {isAudioMenuOpen ? (
        <div
          role="menu"
          className={cn(
            'absolute bottom-full right-0 z-[60] mb-2 min-w-40 rounded-xl border bg-popover px-2 py-2 text-popover-foreground shadow-xl',
            isFull && 'min-w-44 border-zinc-700 bg-zinc-900 text-white',
          )}
        >
          <p className="px-2 py-1.5 text-sm font-semibold">
            {t('callVoiceProcessingLabel')}
          </p>
          <div className="-mx-0 my-1 h-px bg-neutral-6" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={voiceProcessingPreset === 'standard'}
            onClick={() => selectVoicePreset('standard')}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span>{t('callVoiceProcessingStandard')}</span>
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
            <span>{t('callVoiceProcessingIsolation')}</span>
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
            <span>{t('callVoiceProcessingMusic')}</span>
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
        title={`${t(
          'callCaptureLabel',
        )}: ${captureModeLabel} - ${captureStatusText}`}
        aria-label={`${t('callCaptureLabel')}: ${captureModeLabel}`}
        aria-haspopup="menu"
        aria-expanded={isCaptureMenuOpen}
        onClick={() => setIsCaptureMenuOpen((open) => !open)}
      >
        {captureMode === 'none' ? (
          <Square className={captureIconClass} />
        ) : captureMode === 'transcript_only' ? (
          <FileText className={captureIconClass} />
        ) : (
          <Circle className={captureRecordingIconClass} />
        )}
        <span
          className={cn(
            'absolute -bottom-0.5 -right-0.5 block h-2.5 w-2.5 rounded-full ring-2 ring-background',
            isFull && 'ring-zinc-900',
            captureStatusDotClass,
          )}
        />
      </button>
      {isCaptureMenuOpen ? (
        <div
          role="menu"
          className={cn(
            'absolute bottom-full right-0 z-[60] mb-2 min-w-52 rounded-xl border bg-popover px-2 py-2 text-popover-foreground shadow-xl',
            isFull && 'border-zinc-700 bg-zinc-900 text-white',
          )}
        >
          <p className="px-2 py-1.5 text-sm font-semibold">
            {t('callCaptureLabel')}
          </p>
          <div className="-mx-0 my-1 h-px bg-neutral-6" />
          <button
            type="button"
            role="menuitemradio"
            aria-checked={captureMode === 'none'}
            onClick={() => selectCaptureMode('none')}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span className="inline-flex items-center gap-2">
              <Square className="h-4 w-4" />
              {t('callCaptureModeNone')}
            </span>
            {captureMode === 'none' ? (
              <Check className={menuCheckIcon} />
            ) : null}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={captureMode === 'transcript_only'}
            onClick={() => selectCaptureMode('transcript_only')}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span className="inline-flex items-center gap-2">
              <FileText className="h-4 w-4" />
              {t('callCaptureModeTranscriptOnly')}
            </span>
            {captureMode === 'transcript_only' ? (
              <Check className={menuCheckIcon} />
            ) : null}
          </button>
          <button
            type="button"
            role="menuitemradio"
            aria-checked={captureMode === 'recording_with_transcript'}
            onClick={() => selectCaptureMode('recording_with_transcript')}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-1 transition-colors hover:bg-muted/80"
          >
            <span className="inline-flex items-center gap-2">
              <Circle className="h-4 w-4 text-rose-600 stroke-rose-600" />
              {t('callCaptureModeRecordingWithTranscript')}
            </span>
            {captureMode === 'recording_with_transcript' ? (
              <Check className={menuCheckIcon} />
            ) : null}
          </button>
        </div>
      ) : null}
    </div>
  );

  return (
    <div role="group" aria-label={t('callToolbarLabel')}>
      <div
        className={cn(
          useSideAudioSettings
            ? 'grid w-full grid-cols-[1fr_auto_1fr] items-center'
            : 'flex w-auto items-center',
        )}
      >
        <div />
        <div
          className={cn(
            'flex items-center',
            isCenteredInBanner ? 'gap-2.5 sm:gap-3' : 'gap-1.5 sm:gap-2',
            useSideAudioSettings ? 'justify-center' : 'justify-start',
          )}
        >
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
              <MicOff className={icon} />
            ) : (
              <Mic className={icon} />
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
              <VideoOff className={icon} />
            ) : (
              <Video className={icon} />
            )}
          </button>
          <button
            type="button"
            onClick={onToggleScreenshare}
            disabled={controlsDisabled}
            className={cn(
              isFull
                ? isScreensharing
                  ? shareActiveBtn
                  : baseBtn
                : isScreensharing
                ? shareActiveBtn
                : neutralBtn,
              (isFull || isScreensharing) &&
                'inline-flex items-center justify-center',
              'disabled:cursor-not-allowed',
              !isFull && controlsDisabled && 'opacity-50',
            )}
            title={t('callControlsScreenshare')}
            aria-label={
              isScreensharing
                ? t('callControlsScreenshareActiveAria')
                : t('callControlsScreenshareInactiveAria')
            }
          >
            {isScreensharing ? (
              <MonitorOff className={icon} />
            ) : (
              <Monitor className={icon} />
            )}
          </button>
          <button
            type="button"
            onClick={handleLeaveWithCaptureGuard}
            disabled={callState === 'disconnecting'}
            className={cn(
              leaveBtn,
              'disabled:cursor-not-allowed',
              callState === 'disconnecting' && 'opacity-50',
            )}
            title={t('callLeave')}
            aria-label={t('callLeave')}
          >
            <CallHangUpIcon className={leaveIcon} />
          </button>
          {!useSideAudioSettings ? renderCaptureMenu : null}
          {!useSideAudioSettings ? renderAudioSettingsMenu : null}
        </div>
        {useSideAudioSettings ? (
          <div className="justify-self-end flex items-center gap-2">
            {renderCaptureMenu}
            {renderAudioSettingsMenu}
          </div>
        ) : null}
      </div>
      {captureOff ? (
        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">
          {leaveWithoutCaptureArmed
            ? t('callCaptureLeaveWarning')
            : t('callCaptureOffHint')}
        </p>
      ) : null}
      {recordingStatus === 'error' && recordingError?.trim() ? (
        <p className={cn('mt-1 text-[11px] text-destructive')}>
          {recordingError}
        </p>
      ) : null}
    </div>
  );
}
