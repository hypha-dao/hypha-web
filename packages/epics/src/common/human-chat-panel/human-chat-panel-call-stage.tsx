'use client';

import {
  useCallback,
  useEffect,
  useId,
  useReducer,
  useRef,
  type RefObject,
} from 'react';
import type { MatrixClient, GroupCall, Room } from 'matrix-js-sdk';
import {
  CallFeedEvent,
  type CallFeed,
} from 'matrix-js-sdk/lib/webrtc/callFeed';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Maximize2, User } from 'lucide-react';
import { matrixMemberDisplayLabel } from './matrix-room-member-display';

export type HumanChatPanelCallStageLayout = 'panel' | 'fullView' | 'hidden';

type HumanChatPanelCallStageBaseProps = {
  client: MatrixClient | null;
  roomId: string | null;
  groupCall: GroupCall | null;
  callKind: 'audio' | 'video' | null;
  isLocalVideoMuted: boolean;
  isScreensharing: boolean;
  callState: string;
  feedVersion: number;
  activeSpeakerKey: string | null;
  currentUserId: string | null;
  resolveMemberLabel: (userId: string | undefined) => string;
};

type HumanChatPanelCallStageProps = HumanChatPanelCallStageBaseProps & {
  layout: HumanChatPanelCallStageLayout;
  /** Shown in panel when full view is available; opens the enlarged dialog. */
  onRequestFullView?: () => void;
  /** `true` when the app-level full-view dialog is open; hides the inline stage so one video tree remains mounted. */
  fullViewOpen?: boolean;
  /** `ref` for the expand trigger (return focus on dialog close; Radix handles this if this ref is the trigger). */
  fullViewTriggerRef?: RefObject<HTMLButtonElement | null>;
};

function feedKeyForActive(feed: CallFeed): string {
  return `${feed.userId}::${feed.deviceId ?? ''}`;
}

function feedKey(feed: CallFeed, index: number): string {
  return `${feed.userId}:${String(feed.deviceId)}:${String(
    feed.purpose,
  )}:${index}`;
}

export type CallStageContentModel = {
  kind: 'hidden' | 'screenSharePendingStrip' | 'main';
  isVideoCall: boolean;
  userMediaFeeds: CallFeed[];
  shareFeeds: CallFeed[];
  hasLocalWebcam: boolean;
  remoteUserMedia: CallFeed[];
  localUserMedia: CallFeed[];
  hasRemotesOrShare: boolean;
  showLocalInMainGrid: boolean;
  showLocalPip: boolean;
};

/**
 * Feeds the same gating as {@link HumanChatPanelCallStage} to decide if the
 * enlarged (modal) call view is meaningful — not for the "screen share is on" text strip alone.
 */
export function getHumanChatPanelCallStageModel(
  groupCall: GroupCall | null,
  callKind: 'audio' | 'video' | null,
  isLocalVideoMuted: boolean,
  isScreensharing: boolean,
  callState: string,
): CallStageContentModel | null {
  if (callState !== 'connected' || !groupCall) {
    return null;
  }
  if (callKind !== 'video' && callKind !== 'audio') {
    return null;
  }

  const isVideoCall = callKind === 'video';
  const userMediaFeeds = [...groupCall.userMediaFeeds];
  const shareFeeds = [...groupCall.screenshareFeeds];
  const hasLocalWebcam = isVideoCall && !isLocalVideoMuted;
  if (!isVideoCall && shareFeeds.length === 0) {
    return {
      kind: 'hidden',
      isVideoCall,
      userMediaFeeds,
      shareFeeds,
      hasLocalWebcam,
      remoteUserMedia: [],
      localUserMedia: [],
      hasRemotesOrShare: false,
      showLocalInMainGrid: false,
      showLocalPip: false,
    };
  }
  if (isVideoCall && !hasLocalWebcam && shareFeeds.length === 0) {
    if (isScreensharing) {
      return {
        kind: 'screenSharePendingStrip',
        isVideoCall,
        userMediaFeeds,
        shareFeeds,
        hasLocalWebcam,
        remoteUserMedia: [],
        localUserMedia: [],
        hasRemotesOrShare: false,
        showLocalInMainGrid: false,
        showLocalPip: false,
      };
    }
    return {
      kind: 'hidden',
      isVideoCall,
      userMediaFeeds,
      shareFeeds,
      hasLocalWebcam,
      remoteUserMedia: [],
      localUserMedia: [],
      hasRemotesOrShare: false,
      showLocalInMainGrid: false,
      showLocalPip: false,
    };
  }

  const remoteUserMedia = userMediaFeeds.filter((f) => !f.isLocal());
  const localUserMedia = userMediaFeeds.filter((f) => f.isLocal());
  const hasRemotesOrShare = shareFeeds.length > 0 || remoteUserMedia.length > 0;
  const showLocalInMainGrid =
    !hasRemotesOrShare && localUserMedia.length > 0 && hasLocalWebcam;
  const showLocalPip = hasRemotesOrShare;
  return {
    kind: 'main',
    isVideoCall,
    userMediaFeeds,
    shareFeeds,
    hasLocalWebcam,
    remoteUserMedia,
    localUserMedia,
    hasRemotesOrShare,
    showLocalInMainGrid,
    showLocalPip,
  };
}

/** `true` when a full-size stage (grid / tiles) is on screen — user may open the enlarged dialog. */
export function canOpenHumanChatCallFullView(
  groupCall: GroupCall | null,
  callKind: 'audio' | 'video' | null,
  isLocalVideoMuted: boolean,
  isScreensharing: boolean,
  callState: string,
): boolean {
  const m = getHumanChatPanelCallStageModel(
    groupCall,
    callKind,
    isLocalVideoMuted,
    isScreensharing,
    callState,
  );
  return m?.kind === 'main';
}

/**
 * Video grid + local PiP from GroupCall userMedia / screenshare feeds.
 * Use `layout: 'panel' | 'fullView' | 'hidden'`: mount **one** instance with
 * `fullView` when the modal is open, and `hidden` in the panel so streams stay
 * single-sourced (spec §3.4.4).
 * @see voice-video-call-implementation-spec.md §3.4.2, §3.4.4, §3.5
 */
export function HumanChatPanelCallStage({
  client,
  roomId,
  groupCall,
  callKind,
  isLocalVideoMuted,
  isScreensharing,
  callState,
  feedVersion: _feedVersion,
  activeSpeakerKey,
  currentUserId,
  resolveMemberLabel,
  layout,
  onRequestFullView,
  fullViewOpen = false,
  fullViewTriggerRef,
}: HumanChatPanelCallStageProps) {
  const t = useTranslations('HumanChatPanel');
  const labelId = useId();
  const model = getHumanChatPanelCallStageModel(
    groupCall,
    callKind,
    isLocalVideoMuted,
    isScreensharing,
    callState,
  );
  const handleExpand = useCallback(() => {
    onRequestFullView?.();
  }, [onRequestFullView]);

  if (!model) {
    return null;
  }

  if (model.kind === 'screenSharePendingStrip') {
    if (layout === 'fullView') {
      return null;
    }
    return (
      <section
        className="shrink-0 border-b border-border bg-muted/20 px-3 py-2"
        role="status"
      >
        <p className="text-xs text-muted-foreground">
          {t('callScreenShareActive')}
        </p>
      </section>
    );
  }
  if (model.kind === 'hidden') {
    return null;
  }
  if (layout === 'hidden' && model.kind === 'main') {
    return null;
  }

  const {
    isVideoCall,
    shareFeeds,
    hasLocalWebcam,
    remoteUserMedia,
    localUserMedia,
    hasRemotesOrShare,
    showLocalInMainGrid,
    showLocalPip,
  } = model;

  const isFull = layout === 'fullView';
  const userGridTileCount =
    remoteUserMedia.length + (showLocalInMainGrid ? localUserMedia.length : 0);
  /** Spec §3.4.4.1 FV-1: avoid 2–3 col grid with one child (empty “void” column). */
  const fullViewUserColumnClass =
    userGridTileCount <= 1
      ? 'grid-cols-1'
      : userGridTileCount === 2
      ? 'grid-cols-1 sm:grid-cols-2'
      : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3';
  /**
   * In-panel (sidebar): same FV-1 as full view — one user tile = `grid-cols-1` only
   * so the video uses the full stage width (no empty second column from `@24rem:2`).
   */
  const panelUserGridColumnClass =
    userGridTileCount <= 1
      ? 'grid-cols-1'
      : userGridTileCount === 2
      ? 'grid-cols-1 @min-[22rem]:grid-cols-2'
      : 'grid-cols-1 @min-[22rem]:grid-cols-2 @min-[32rem]:grid-cols-3';
  /** One camera tile only, no share: flex column fill (no empty grid track / FV-1). */
  const useFullViewSingleMainTile =
    isFull && userGridTileCount === 1 && shareFeeds.length === 0;

  const room: Room | null =
    roomId && client ? client.getRoom(roomId) ?? null : null;

  const showExpand = layout === 'panel' && !fullViewOpen && onRequestFullView;

  if (!isFull && !(hasRemotesOrShare || showLocalInMainGrid)) {
    return null;
  }
  if (!isFull && isVideoCall && !hasLocalWebcam && shareFeeds.length === 0) {
    return null;
  }

  return (
    <section
      className={cn(
        'relative w-full max-w-full @container/call',
        isFull
          ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-0 bg-black py-0'
          : 'shrink-0 border-b border-border bg-muted/20 min-h-[min(32vh,200px)]',
      )}
      role="region"
      aria-labelledby={labelId}
    >
      {showExpand && (
        <div className="absolute end-2 top-2 z-20">
          <button
            type="button"
            ref={fullViewTriggerRef}
            onClick={handleExpand}
            className={cn(
              'flex h-8 w-8 items-center justify-center rounded-full border border-border/80 bg-background/90 text-foreground shadow-sm ring-offset-background',
              'transition hover:bg-accent/90 focus-visible:outline focus-visible:ring-2 focus-visible:ring-ring',
              'motion-reduce:transition-none',
            )}
            aria-haspopup="dialog"
            aria-expanded={fullViewOpen}
            title={t('callFullView')}
            aria-label={t('callFullView')}
          >
            <Maximize2 className="h-4 w-4" aria-hidden />
          </button>
        </div>
      )}
      <h2 id={labelId} className="sr-only">
        {isFull ? t('callFullView') : t('callStageLabel')}
      </h2>
      {shareFeeds.length > 0 && (
        <div
          className={cn(
            'w-full p-2 pb-0',
            isFull && 'flex min-h-0 min-w-0 flex-1 flex-col p-0',
            isFull && shareFeeds.length > 0 && 'min-w-0', // FV-1: full width of main stage
          )}
          data-feed-tick={_feedVersion}
        >
          {shareFeeds.map((feed, i) => (
            <div
              key={feedKey(feed, i)}
              className={cn(
                'w-full max-w-full',
                isFull && 'flex min-h-0 min-w-0 flex-1 flex-col',
              )}
            >
              <CallFeedTile
                feed={feed}
                isShare
                isFullView={isFull}
                isActiveSpeaker={
                  activeSpeakerKey != null &&
                  activeSpeakerKey === feedKeyForActive(feed)
                }
                room={room}
                currentUserId={currentUserId}
                resolveMemberLabel={resolveMemberLabel}
                t={t}
              />
            </div>
          ))}
        </div>
      )}
      {(hasRemotesOrShare || showLocalInMainGrid) &&
        (useFullViewSingleMainTile ? (
          <div
            className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col px-2 pb-2 pt-0"
            data-feed-tick={_feedVersion}
          >
            {remoteUserMedia[0] ? (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
                <CallFeedTile
                  feed={remoteUserMedia[0]}
                  isFullView={isFull}
                  isActiveSpeaker={
                    activeSpeakerKey != null &&
                    activeSpeakerKey === feedKeyForActive(remoteUserMedia[0]!)
                  }
                  room={room}
                  currentUserId={currentUserId}
                  resolveMemberLabel={resolveMemberLabel}
                  t={t}
                />
              </div>
            ) : showLocalInMainGrid && localUserMedia[0] ? (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
                <CallFeedTile
                  feed={localUserMedia[0]}
                  isFullView={isFull}
                  isActiveSpeaker={
                    activeSpeakerKey != null &&
                    activeSpeakerKey === feedKeyForActive(localUserMedia[0]!)
                  }
                  room={room}
                  currentUserId={currentUserId}
                  resolveMemberLabel={resolveMemberLabel}
                  t={t}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              'grid gap-2 p-2 pt-2',
              isFull
                ? cn(
                    'h-full min-h-0 w-full min-w-0 flex-1',
                    'content-stretch items-stretch [grid-auto-rows:minmax(0,1fr)]',
                    fullViewUserColumnClass,
                    'overflow-y-auto px-2 pb-2 pt-0',
                    // FV-5: when screen share is primary, user tiles are a bounded strip
                    shareFeeds.length > 0
                      ? 'max-h-[min(40dvh,320px)] shrink-0'
                      : null,
                  )
                : cn(
                    shareFeeds.length > 0 ? 'max-h-[min(50vh,420px)]' : null,
                    panelUserGridColumnClass,
                  ),
              !isFull &&
                !shareFeeds.length &&
                remoteUserMedia.length > 0 &&
                'min-h-[min(32vh,220px)]',
              !isFull && showLocalInMainGrid && 'min-h-[min(32vh,240px)]',
            )}
            data-feed-tick={_feedVersion}
          >
            {remoteUserMedia.map((feed, i) => (
              <div
                key={feedKey(feed, i)}
                className={isFull ? 'min-h-0 w-full min-w-0' : undefined}
              >
                <CallFeedTile
                  feed={feed}
                  isFullView={isFull}
                  isActiveSpeaker={
                    activeSpeakerKey != null &&
                    activeSpeakerKey === feedKeyForActive(feed)
                  }
                  room={room}
                  currentUserId={currentUserId}
                  resolveMemberLabel={resolveMemberLabel}
                  t={t}
                />
              </div>
            ))}
            {showLocalInMainGrid &&
              localUserMedia.map((feed, i) => (
                <div
                  key={feedKey(feed, i)}
                  className={isFull ? 'min-h-0 w-full min-w-0' : undefined}
                >
                  <CallFeedTile
                    feed={feed}
                    isFullView={isFull}
                    isActiveSpeaker={
                      activeSpeakerKey != null &&
                      activeSpeakerKey === feedKeyForActive(feed)
                    }
                    room={room}
                    currentUserId={currentUserId}
                    resolveMemberLabel={resolveMemberLabel}
                    t={t}
                  />
                </div>
              ))}
          </div>
        ))}
      {isVideoCall &&
        localUserMedia.length > 0 &&
        hasLocalWebcam &&
        showLocalPip && (
          <div
            className={cn(
              'pointer-events-none absolute z-10 overflow-hidden rounded-lg border-2 border-border bg-card shadow-lg',
              isFull
                ? 'end-4 bottom-4 w-[min(22%,11rem)] min-w-[5.5rem]'
                : 'bottom-2 end-2 w-[32%] min-w-[5.5rem] max-w-[8.5rem]',
            )}
            style={{ aspectRatio: '4 / 3' }}
          >
            {localUserMedia.map((feed, i) => (
              <CallFeedTile
                key={feedKey(feed, i)}
                feed={feed}
                isPip
                isFullView={isFull}
                isActiveSpeaker={
                  activeSpeakerKey != null &&
                  activeSpeakerKey === feedKeyForActive(feed)
                }
                room={room}
                currentUserId={currentUserId}
                resolveMemberLabel={resolveMemberLabel}
                t={t}
              />
            ))}
          </div>
        )}
    </section>
  );
}

function displayLabel(
  room: Room | null,
  feed: CallFeed,
  currentUserId: string | null,
  resolveMemberLabel: (userId: string | undefined) => string,
  fallback: string,
): string {
  if (feed.isLocal() && currentUserId) {
    return resolveMemberLabel(currentUserId);
  }
  const m = room?.getMember(feed.userId) ?? null;
  if (m) return matrixMemberDisplayLabel(m, feed.userId);
  return resolveMemberLabel(feed.userId) || fallback;
}

const CallFeedTile = ({
  feed,
  isShare = false,
  isPip = false,
  isActiveSpeaker = false,
  isFullView = false,
  room,
  currentUserId,
  resolveMemberLabel,
  t,
}: {
  feed: CallFeed;
  isShare?: boolean;
  isPip?: boolean;
  isActiveSpeaker?: boolean;
  isFullView?: boolean;
  room: Room | null;
  currentUserId: string | null;
  resolveMemberLabel: (userId: string | undefined) => string;
  t: (key: string) => string;
}) => {
  const label = isPip
    ? t('callYou')
    : isShare
    ? displayLabel(
        room,
        feed,
        currentUserId,
        resolveMemberLabel,
        t('callScreenShare'),
      )
    : displayLabel(
        room,
        feed,
        currentUserId,
        resolveMemberLabel,
        t('callRemoteParticipant'),
      );
  return (
    <FeedContent
      feed={feed}
      isShare={isShare}
      isPip={isPip}
      isFullView={isFullView}
      isActiveSpeaker={isActiveSpeaker}
      label={label}
      t={t}
    />
  );
};

const FeedContent = ({
  feed,
  isShare,
  isPip,
  isFullView,
  isActiveSpeaker,
  label,
  t,
}: {
  feed: CallFeed;
  isShare: boolean;
  isPip: boolean;
  isFullView: boolean;
  isActiveSpeaker: boolean;
  label: string;
  t: (key: string) => string;
}) => {
  const ref = useRef<HTMLVideoElement | null>(null);
  const stream = feed.stream;

  const [, rerenderOnFeed] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    const p = el.play();
    p.catch(() => {});

    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const onFeedVisualChange = () => {
      rerenderOnFeed();
    };
    feed.on(CallFeedEvent.MuteStateChanged, onFeedVisualChange);
    feed.on(CallFeedEvent.NewStream, onFeedVisualChange);
    feed.on(CallFeedEvent.Speaking, onFeedVisualChange);
    return () => {
      feed.removeListener(CallFeedEvent.MuteStateChanged, onFeedVisualChange);
      feed.removeListener(CallFeedEvent.NewStream, onFeedVisualChange);
      feed.removeListener(CallFeedEvent.Speaking, onFeedVisualChange);
    };
  }, [feed]);

  const hasVideo = !feed.isVideoMuted() && stream.getVideoTracks().length > 0;

  return (
    <div
      className={cn(
        'relative min-w-0 overflow-hidden rounded-lg bg-black/20',
        isFullView && !isPip
          ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col'
          : 'flex min-h-[10rem] items-stretch justify-center',
        isShare && !isFullView && 'min-h-[min(42vh,360px)] w-full',
        isShare && isFullView && 'h-full min-h-0 w-full',
        isActiveSpeaker && 'ring-2 ring-accent-9/70 ring-offset-0',
        isPip && 'flex min-h-0',
      )}
    >
      {hasVideo ? (
        <>
          <video
            ref={ref}
            className={cn(
              isPip
                ? 'max-h-24 w-full object-contain'
                : isFullView
                ? 'absolute inset-0 h-full w-full object-contain'
                : 'w-full min-h-[10rem] max-h-[min(40vh,360px)] object-contain',
            )}
            autoPlay
            playsInline
            muted={feed.isLocal()}
            aria-label={label}
          />
          {!isPip && (
            <div
              className={cn(
                'absolute start-1 z-[1] max-w-[90%] truncate rounded bg-background/80 px-1.5 py-0.5 text-xs',
                isFullView ? 'bottom-2' : 'bottom-1',
              )}
            >
              {label}
            </div>
          )}
        </>
      ) : (
        <div
          className={cn(
            'flex w-full flex-col items-center justify-center gap-1 p-2 text-center',
            isFullView && !isPip ? 'min-h-0 flex-1' : 'min-h-[10rem]',
          )}
          aria-label={label}
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <User className="h-7 w-7" />
          </div>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {label}
            {feed.isAudioMuted() && !feed.isLocal()
              ? ` · ${t('callParticipantMuted')}`
              : null}
            {feed.isLocal() && feed.isAudioMuted()
              ? ` · ${t('callParticipantMuted')}`
              : null}
          </span>
        </div>
      )}
    </div>
  );
};
