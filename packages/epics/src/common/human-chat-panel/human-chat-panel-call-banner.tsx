'use client';

import { Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import {
  getCallControlsPhase,
  type SpaceGroupCallCaptureConsent,
  type SpaceGroupCallCaptureMode,
  type SpaceGroupCallErrorCode,
  type SpaceGroupCallRecordingStatus,
  type SpaceGroupCallState,
} from '@hypha-platform/core/client';
import { HumanChatPanelInCallControls } from './human-chat-panel-in-call-controls';
import { HumanChatPanelCaptureConsentBanner } from './human-chat-panel-capture-consent-banner';

type HumanChatPanelCallBannerProps = {
  callState: SpaceGroupCallState;
  callKind: 'audio' | 'video' | null;
  errorCode: SpaceGroupCallErrorCode | null;
  /** Local screen share; Phase 4 Share / Stop control. */
  isScreensharing: boolean;
  /** Non-fatal display-capture error; does not end the call. */
  screenshareErrorCode: SpaceGroupCallErrorCode | null;
  /** True when document is hidden during an active call (Phase 5.1). */
  tabBackgroundWhileInCall: boolean;
  isMicrophoneMuted: boolean;
  isLocalVideoMuted: boolean;
  /** Active devices in the room GroupCall (from Matrix). */
  participantCount: number;
  /** When >=1, show that others are in the call (not the local user—used for "Y others"). */
  othersInRoomCallCount: number;
  /** Others appear in Matrix state but remote video/audio feed never attached (WebRTC/signaling). */
  remoteMediaStall?: boolean;
  onDismissRemoteMediaStall?: () => void;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onToggleScreenshare: () => void;
  voiceProcessingPreset: 'standard' | 'voice_isolation' | 'music';
  onVoiceProcessingPresetChange: (
    preset: 'standard' | 'voice_isolation' | 'music',
  ) => void;
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
  recordingWarning?: import('@hypha-platform/core/client').CallRecordingCaptureWarning | null;
  canRetryRecordingUpload?: boolean;
  onRetryRecordingUpload?: () => void;
  captureConsent: SpaceGroupCallCaptureConsent | null;
  onDismissScreenshareError: () => void;
  /** Reconnect after a recoverable call error. */
  onRetryCall: () => void;
  onDismissCallError: () => void;
  controlsMode?: 'full' | 'leave_only';
};

function errorKey(code: SpaceGroupCallErrorCode): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'callErrorPermission';
    case 'NOT_READY':
      return 'callErrorNotReady';
    case 'CONNECT_STALL':
      return 'callErrorConnectStall';
    case 'NO_ROOM':
      return 'callErrorNoRoom';
    case 'NO_CLIENT':
      return 'callErrorNoClient';
    default:
      return 'callErrorGeneric';
  }
}

function screenshareErrorKey(code: SpaceGroupCallErrorCode): string {
  return code === 'PERMISSION_DENIED'
    ? 'callErrorPermission'
    : 'callErrorScreenshare';
}

/**
 * In-call strip: space-wide label, connection state, mute, camera, leave.
 */
export function HumanChatPanelCallBanner({
  callState,
  callKind,
  errorCode,
  isScreensharing,
  screenshareErrorCode,
  isMicrophoneMuted,
  isLocalVideoMuted,
  participantCount,
  othersInRoomCallCount,
  remoteMediaStall = false,
  onDismissRemoteMediaStall,
  onLeave,
  onToggleMic,
  onToggleCamera,
  onToggleScreenshare,
  voiceProcessingPreset,
  onVoiceProcessingPresetChange,
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
  captureConsent,
  onDismissScreenshareError,
  tabBackgroundWhileInCall,
  onRetryCall,
  onDismissCallError,
  controlsMode = 'full',
}: HumanChatPanelCallBannerProps) {
  const t = useTranslations('HumanChatPanel');
  const showRetryOnError =
    errorCode != null &&
    (errorCode === 'CONNECT_STALL' ||
      errorCode === 'WEBRTC_FAILED' ||
      errorCode === 'UNKNOWN');

  if (callState === 'error' && errorCode) {
    return (
      <div
        role="alert"
        className="flex min-h-9 items-center gap-2 border-b border-destructive/20 bg-destructive/10 px-3 py-1.5 sm:min-h-10 sm:px-3.5"
        aria-live="assertive"
      >
        <p className="min-w-0 flex-1 text-xs leading-snug text-destructive sm:text-sm">
          {t(errorKey(errorCode))}
          {errorCode === 'PERMISSION_DENIED' ? (
            <>
              {' '}
              <span className="text-destructive/90">
                {t('callErrorPermissionGuidance')}
              </span>
            </>
          ) : null}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {showRetryOnError ? (
            <button
              type="button"
              onClick={onRetryCall}
              className="inline-flex h-7 items-center rounded-md border border-border/80 bg-background/90 px-2 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t('callErrorRetry')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismissCallError}
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-destructive transition-colors hover:bg-destructive/15 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring"
            title={t('callErrorDismiss')}
            aria-label={t('callErrorDismiss')}
          >
            <X className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </button>
        </div>
      </div>
    );
  }

  if (
    callState !== 'connecting' &&
    callState !== 'connected' &&
    callState !== 'awaiting_media' &&
    callState !== 'initializing' &&
    callState !== 'disconnecting'
  ) {
    return null;
  }

  const { isConnectingPhase, isDisconnecting } =
    getCallControlsPhase(callState);

  return (
    <div className="border-b border-border bg-muted/30">
      <div
        role="status"
        className="sr-only"
        aria-live="polite"
        aria-atomic="true"
      >
        {isConnectingPhase
          ? t('callConnecting')
          : callState === 'connected'
          ? t('callActiveInSpace')
          : null}
      </div>
      {callState === 'connected' && tabBackgroundWhileInCall && (
        <p className="border-b border-border/60 bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
          {t('callTabBackgroundHint')}
        </p>
      )}
      {remoteMediaStall && callState === 'connected' && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-amber-500/25 bg-amber-500/10 px-4 py-1.5"
        >
          <p className="min-w-0 flex-1 text-xs text-amber-950 dark:text-amber-100">
            {t('callRemoteMediaStallHint')}
          </p>
          {onDismissRemoteMediaStall && (
            <button
              type="button"
              onClick={onDismissRemoteMediaStall}
              className="shrink-0 text-xs font-medium text-amber-900 underline-offset-2 hover:underline dark:text-amber-50"
            >
              {t('callLeftBannerDismiss')}
            </button>
          )}
        </div>
      )}
      {screenshareErrorCode && callState === 'connected' && (
        <div
          role="alert"
          className="flex items-start gap-2 border-b border-border/60 bg-destructive/10 px-4 py-1.5"
        >
          <p className="min-w-0 flex-1 text-xs text-destructive">
            {t(screenshareErrorKey(screenshareErrorCode))}
          </p>
          <button
            type="button"
            onClick={onDismissScreenshareError}
            className="shrink-0 text-xs font-medium text-destructive underline-offset-2 hover:underline"
          >
            {t('callScreenshareDismiss')}
          </button>
        </div>
      )}
      {callState === 'connected' && captureConsent ? (
        <HumanChatPanelCaptureConsentBanner
          consent={captureConsent}
          variant="inCall"
        />
      ) : null}
      <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-4 py-2">
        <div className="min-w-0 flex-1 basis-0 pr-1 sm:pr-2">
          {callState === 'connected' ? (
            othersInRoomCallCount === 0 ? (
              <p className="text-xs font-medium leading-tight text-foreground">
                <span className="block max-w-full">
                  {t('callBannerInCallSoloLine1', { count: participantCount })}
                </span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground sm:text-xs">
                  {t('callBannerInCallSoloLine2')}
                </span>
              </p>
            ) : (
              <p
                className="text-xs font-medium leading-tight text-foreground"
                title={t('callBannerInCallWithOthers', {
                  count: participantCount,
                  otherCount: othersInRoomCallCount,
                })}
              >
                {t('callBannerInCallWithOthers', {
                  count: participantCount,
                  otherCount: othersInRoomCallCount,
                })}
              </p>
            )
          ) : (
            <p className="text-xs font-medium leading-tight text-foreground">
              {t('callActiveInSpace')}
            </p>
          )}
          {isDisconnecting && (
            <p className="text-xs text-muted-foreground">
              {t('callDisconnecting')}
            </p>
          )}
          {isConnectingPhase && (
            <p className="text-xs text-muted-foreground">
              {t('callConnecting')}
            </p>
          )}
        </div>
        {isConnectingPhase && (
          <Loader2
            className="h-4 w-4 shrink-0 motion-reduce:animate-none animate-spin text-muted-foreground"
            aria-hidden
          />
        )}
        <div className="shrink-0">
          <HumanChatPanelInCallControls
            callState={callState}
            isMicrophoneMuted={isMicrophoneMuted}
            isLocalVideoMuted={isLocalVideoMuted}
            isScreensharing={isScreensharing}
            onToggleMic={onToggleMic}
            onToggleCamera={onToggleCamera}
            onToggleScreenshare={onToggleScreenshare}
            voiceProcessingPreset={voiceProcessingPreset}
            onVoiceProcessingPresetChange={onVoiceProcessingPresetChange}
            captureMode={captureMode}
            capturePreference={capturePreference}
            capturePreferenceSelected={capturePreferenceSelected}
            onCapturePreferenceChange={onCapturePreferenceChange}
            onStartCapture={onStartCapture}
            onPauseCapture={onPauseCapture}
            onResumeCapture={onResumeCapture}
            onStopCapture={onStopCapture}
            recordingStatus={recordingStatus}
            recordingError={recordingError}
            recordingWarning={recordingWarning}
            canRetryRecordingUpload={canRetryRecordingUpload}
            onRetryRecordingUpload={onRetryRecordingUpload}
            onLeave={onLeave}
            variant="inBanner"
            controlsMode={controlsMode}
          />
        </div>
      </div>
    </div>
  );
}
