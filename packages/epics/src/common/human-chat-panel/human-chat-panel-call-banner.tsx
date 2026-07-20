'use client';

import { Loader2, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import {
  getCallControlsPhase,
  type SpaceGroupCallCaptureConsent,
  type SpaceGroupCallCaptureMode,
  type SpaceGroupCallErrorCode,
  type SpaceGroupCallRecordingStatus,
  type SpaceGroupCallState,
} from '@hypha-platform/core/client';
import { HumanChatPanelInCallControls } from './human-chat-panel-in-call-controls';
import type { CallFloatingReactionStyle } from './call-zoom-reaction-catalog';
import { HumanChatPanelCaptureConsentBanner } from './human-chat-panel-capture-consent-banner';
import {
  callAccentAlertActionButtonClassName,
  callAccentAlertCompactRowClassName,
  callAccentAlertDismissClassName,
  callAccentAlertIconButtonClassName,
  callAccentAlertRowClassName,
  callAccentAlertSecondaryText,
  callAccentAlertText,
} from './call-accent-alert-styles';

type HumanChatPanelCallBannerProps = {
  callState: SpaceGroupCallState;
  callKind: 'audio' | 'video' | null;
  errorCode: SpaceGroupCallErrorCode | null;
  /** Local screen share; Phase 4 Share / Stop control. */
  isScreensharing: boolean;
  /** Another participant is presenting — local share start is disabled. */
  remoteScreenshareActive?: boolean;
  /** Non-fatal display-capture error; does not end the call. */
  screenshareErrorCode: SpaceGroupCallErrorCode | null;
  /** Presenter started share without tab/window audio (WCUX-SHARE-AUDIO-2). */
  screenshareTabAudioMissing?: boolean;
  onDismissScreenshareTabAudioHint?: () => void;
  /** Re-open the browser picker and request tab/window audio. */
  onRetryScreenshareWithTabAudio?: () => void;
  /** Camera permission denied when unmuting video mid audio call. */
  cameraAccessBlocked?: boolean;
  onDismissCameraAccessBlocked?: () => void;
  /** Matrix token refresh failed mid-call — blocking reconnect (WCUX-SESSION-3). */
  sessionRefreshFailedDuringCall?: boolean;
  onReconnectMatrixSession?: () => void;
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
  /** Remote feeds still warming (CSH-MESH-3). */
  remoteMediaWarming?: boolean;
  /** Homeserver returned no usable TURN relay ICE servers for this session. */
  turnServerUnavailable?: boolean;
  onDismissTurnServerUnavailable?: () => void;
  onDismissRemoteMediaStall?: () => void;
  onRetryRemoteMedia?: () => void;
  /** CSH-SCALE-2 — many participants may reduce mesh quality. */
  showScaleWarning?: boolean;
  onLeave: () => void;
  onToggleMic: () => void;
  onToggleCamera: () => void;
  onStartScreenshare: () => void;
  onStopScreenshare: () => void;
  voiceProcessingPreset: 'standard' | 'voice_isolation' | 'music';
  onVoiceProcessingPresetChange: (
    preset: 'standard' | 'voice_isolation' | 'music',
  ) => void;
  presenterVoiceBoostActive?: boolean;
  unsupportedVoiceProcessingConstraints?: {
    autoGainControl: boolean;
    echoCancellation: boolean;
    noiseSuppression: boolean;
  } | null;
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
  recordingWarning?:
    | import('@hypha-platform/core/client').CallRecordingCaptureWarning
    | null;
  canRetryRecordingUpload?: boolean;
  onRetryRecordingUpload?: () => void;
  captureConsent: SpaceGroupCallCaptureConsent | null;
  roomId?: string | null;
  onDismissScreenshareError: () => void;
  /** Reconnect after a recoverable call error. */
  onRetryCall: () => void;
  onDismissCallError: () => void;
  controlsMode?: 'full' | 'leave_only';
  /** Alerts and consent only — omit participant row and toolbar (e.g. floating dock footer). */
  alertsOnly?: boolean;
  /** Participant status text only — no in-banner controls (mobile dock footer). */
  participantRowOnly?: boolean;
  /** Tighter alert rows for Document PiP. */
  alertDensity?: 'default' | 'pip';
  canSendCallReactions?: boolean;
  localHandRaised?: boolean;
  onSendReaction?: (
    emoji: string,
    style?: CallFloatingReactionStyle,
  ) => void | Promise<void>;
  onToggleRaiseHand?: () => void | Promise<void>;
  includeReactionsWhenLeaveOnly?: boolean;
};

function errorKey(code: SpaceGroupCallErrorCode): string {
  switch (code) {
    case 'PERMISSION_DENIED':
      return 'callErrorPermission';
    case 'DEVICE_NOT_FOUND':
      return 'callErrorDeviceNotFound';
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
  remoteScreenshareActive = false,
  screenshareErrorCode,
  screenshareTabAudioMissing = false,
  onDismissScreenshareTabAudioHint,
  onRetryScreenshareWithTabAudio,
  cameraAccessBlocked = false,
  onDismissCameraAccessBlocked,
  sessionRefreshFailedDuringCall = false,
  onReconnectMatrixSession,
  isMicrophoneMuted,
  isLocalVideoMuted,
  participantCount,
  othersInRoomCallCount,
  remoteMediaStall = false,
  remoteMediaWarming = false,
  turnServerUnavailable = false,
  onDismissTurnServerUnavailable,
  onDismissRemoteMediaStall,
  onRetryRemoteMedia,
  showScaleWarning = false,
  onLeave,
  onToggleMic,
  onToggleCamera,
  onStartScreenshare,
  onStopScreenshare,
  voiceProcessingPreset,
  onVoiceProcessingPresetChange,
  presenterVoiceBoostActive = false,
  unsupportedVoiceProcessingConstraints = null,
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
  roomId = null,
  onDismissScreenshareError,
  tabBackgroundWhileInCall,
  onRetryCall,
  onDismissCallError,
  controlsMode = 'full',
  alertsOnly = false,
  participantRowOnly = false,
  alertDensity = 'default',
  canSendCallReactions = false,
  localHandRaised = false,
  onSendReaction,
  onToggleRaiseHand,
  includeReactionsWhenLeaveOnly = false,
}: HumanChatPanelCallBannerProps) {
  const t = useTranslations('HumanChatPanel');
  const isPipAlertDensity = alertDensity === 'pip';
  const alertRowClassName = isPipAlertDensity
    ? callAccentAlertCompactRowClassName
    : callAccentAlertRowClassName;
  const alertTextClassName = cn(
    isPipAlertDensity ? 'text-[10px] leading-tight' : 'text-xs leading-snug',
    callAccentAlertText,
  );
  const showRetryOnError =
    errorCode != null &&
    (errorCode === 'CONNECT_STALL' ||
      errorCode === 'WEBRTC_FAILED' ||
      errorCode === 'UNKNOWN');

  if (callState === 'error' && errorCode) {
    return (
      <div
        role="alert"
        className={callAccentAlertCompactRowClassName()}
        aria-live="assertive"
      >
        <p
          className={cn(
            'min-w-0 flex-1 text-xs leading-snug sm:text-sm',
            callAccentAlertText,
          )}
        >
          {t(errorKey(errorCode))}
          {errorCode === 'PERMISSION_DENIED' ? (
            <>
              {' '}
              <span className={callAccentAlertSecondaryText}>
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
              className={callAccentAlertActionButtonClassName}
            >
              {t('callErrorRetry')}
            </button>
          ) : null}
          <button
            type="button"
            onClick={onDismissCallError}
            className={callAccentAlertIconButtonClassName}
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

  const showTabBackgroundHint =
    callState === 'connected' && tabBackgroundWhileInCall && !alertsOnly;
  const showRemoteMediaWarmingAlert =
    remoteMediaWarming && !remoteMediaStall && callState === 'connected';
  const showRemoteMediaStallAlert =
    remoteMediaStall && callState === 'connected';
  const showTurnServerUnavailableAlert =
    turnServerUnavailable && callState === 'connected';
  const showSessionRefreshAlert =
    sessionRefreshFailedDuringCall && callState === 'connected';
  const showScreenshareErrorAlert =
    screenshareErrorCode != null && callState === 'connected';
  const showScreenshareTabAudioAlert =
    !isPipAlertDensity &&
    screenshareTabAudioMissing &&
    isScreensharing &&
    callState === 'connected';
  const showCameraAccessBlockedAlert =
    cameraAccessBlocked && callState === 'connected';
  const showCaptureConsentAlert =
    callState === 'connected' && captureConsent != null;

  if (alertsOnly) {
    const hasDockAlerts =
      showScaleWarning ||
      showRemoteMediaWarmingAlert ||
      showRemoteMediaStallAlert ||
      showTurnServerUnavailableAlert ||
      showSessionRefreshAlert ||
      showScreenshareErrorAlert ||
      showScreenshareTabAudioAlert ||
      showCameraAccessBlockedAlert ||
      showCaptureConsentAlert;
    if (!hasDockAlerts) {
      return null;
    }
  }

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
      {showTabBackgroundHint ? (
        <p className="border-b border-border/60 bg-muted/50 px-4 py-1.5 text-xs text-muted-foreground">
          {t('callTabBackgroundHint')}
        </p>
      ) : null}
      {showScaleWarning ? (
        <div role="status" className={alertRowClassName()}>
          <p className={cn('min-w-0 flex-1', alertTextClassName)}>
            {t('callScaleWarningMessage')}
          </p>
        </div>
      ) : null}
      {showRemoteMediaWarmingAlert ? (
        <div role="status" className={alertRowClassName()} aria-busy="true">
          <p className={cn('min-w-0 flex-1', alertTextClassName)}>
            {t('callRemoteMediaWarmingHint')}
          </p>
          {onDismissRemoteMediaStall ? (
            <button
              type="button"
              onClick={onDismissRemoteMediaStall}
              className={callAccentAlertDismissClassName}
            >
              {t('callLeftBannerDismiss')}
            </button>
          ) : null}
        </div>
      ) : null}
      {showTurnServerUnavailableAlert ? (
        <div role="alert" className={alertRowClassName()}>
          <p className={cn('min-w-0 flex-1', alertTextClassName)}>
            {t('callTurnServerUnavailableHint')}
          </p>
          {onDismissTurnServerUnavailable ? (
            <button
              type="button"
              onClick={onDismissTurnServerUnavailable}
              className={callAccentAlertDismissClassName}
            >
              {t('callLeftBannerDismiss')}
            </button>
          ) : null}
        </div>
      ) : null}
      {showRemoteMediaStallAlert ? (
        <div role="alert" className={alertRowClassName()}>
          <p className={cn('min-w-0 flex-1', alertTextClassName)}>
            {t('callRemoteMediaStallHint')}
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {onRetryRemoteMedia ? (
              <button
                type="button"
                onClick={onRetryRemoteMedia}
                className={callAccentAlertActionButtonClassName}
              >
                {t('callRemoteMediaStallRetry')}
              </button>
            ) : null}
            {onDismissRemoteMediaStall ? (
              <button
                type="button"
                onClick={onDismissRemoteMediaStall}
                className={callAccentAlertDismissClassName}
              >
                {t('callLeftBannerDismiss')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {showSessionRefreshAlert ? (
        <div role="alert" className={alertRowClassName()}>
          <p className={cn('min-w-0 flex-1', alertTextClassName)}>
            {t('callSessionRefreshFailedDescription')}
          </p>
          {onReconnectMatrixSession ? (
            <button
              type="button"
              onClick={() => {
                void onReconnectMatrixSession();
              }}
              className={callAccentAlertDismissClassName}
            >
              {t('callSessionRefreshFailedReconnect')}
            </button>
          ) : null}
        </div>
      ) : null}
      {showScreenshareErrorAlert ? (
        <div role="alert" className={alertRowClassName()}>
          <p className={cn('min-w-0 flex-1', alertTextClassName)}>
            {t(screenshareErrorKey(screenshareErrorCode))}
          </p>
          <button
            type="button"
            onClick={onDismissScreenshareError}
            className={callAccentAlertDismissClassName}
          >
            {t('callScreenshareDismiss')}
          </button>
        </div>
      ) : null}
      {showScreenshareTabAudioAlert ? (
        <div role="status" className={alertRowClassName()}>
          <p
            className={cn(
              'min-w-0 flex-1 text-xs leading-snug',
              callAccentAlertText,
            )}
          >
            {t('callShareTabAudioNotShared')}{' '}
            <span className={callAccentAlertSecondaryText}>
              {t('callShareTabAudioPickerHint')}
            </span>
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {onRetryScreenshareWithTabAudio ? (
              <button
                type="button"
                onClick={() => {
                  void onRetryScreenshareWithTabAudio();
                }}
                className={callAccentAlertActionButtonClassName}
              >
                {t('callShareTabAudioRetry')}
              </button>
            ) : null}
            {!isScreensharing && onDismissScreenshareTabAudioHint ? (
              <button
                type="button"
                onClick={onDismissScreenshareTabAudioHint}
                className={callAccentAlertDismissClassName}
              >
                {t('callScreenshareDismiss')}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
      {showCameraAccessBlockedAlert ? (
        <div role="alert" className={alertRowClassName()}>
          <p className={cn('min-w-0 flex-1', alertTextClassName)}>
            {t('callErrorPermission')}{' '}
            <span className={callAccentAlertSecondaryText}>
              {t('callErrorPermissionGuidance')}
            </span>
          </p>
          {onDismissCameraAccessBlocked ? (
            <button
              type="button"
              onClick={onDismissCameraAccessBlocked}
              className={callAccentAlertDismissClassName}
            >
              {t('callScreenshareDismiss')}
            </button>
          ) : null}
        </div>
      ) : null}
      {showCaptureConsentAlert ? (
        <HumanChatPanelCaptureConsentBanner
          consent={captureConsent}
          roomId={roomId}
          variant="inCall"
        />
      ) : null}
      {alertsOnly ? null : (
        <div className="flex min-h-[44px] flex-wrap items-center gap-2 px-4 py-2">
          <div className="min-w-0 flex-1 basis-0 pr-1 sm:pr-2">
            {callState === 'connected' ? (
              othersInRoomCallCount === 0 ? (
                <p className="text-xs font-medium leading-tight text-foreground">
                  <span className="block max-w-full">
                    {t('callBannerInCallSoloLine1', {
                      count: participantCount,
                    })}
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
          {!participantRowOnly ? (
            <div className="shrink-0">
              <HumanChatPanelInCallControls
                callState={callState}
                isMicrophoneMuted={isMicrophoneMuted}
                isLocalVideoMuted={isLocalVideoMuted}
                isScreensharing={isScreensharing}
                remoteScreenshareActive={remoteScreenshareActive}
                onToggleMic={onToggleMic}
                onToggleCamera={onToggleCamera}
                onStartScreenshare={onStartScreenshare}
                onStopScreenshare={onStopScreenshare}
                voiceProcessingPreset={voiceProcessingPreset}
                onVoiceProcessingPresetChange={onVoiceProcessingPresetChange}
                presenterVoiceBoostActive={presenterVoiceBoostActive}
                unsupportedVoiceProcessingConstraints={
                  unsupportedVoiceProcessingConstraints
                }
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
                canSendCallReactions={canSendCallReactions}
                localHandRaised={localHandRaised}
                onSendReaction={onSendReaction}
                onToggleRaiseHand={onToggleRaiseHand}
                includeReactionsWhenLeaveOnly={includeReactionsWhenLeaveOnly}
              />
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
