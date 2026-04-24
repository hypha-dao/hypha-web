'use client';

import { useEffect, useId, useReducer, useRef } from 'react';
import type { MatrixClient, GroupCall, Room } from 'matrix-js-sdk';
import {
  CallFeedEvent,
  type CallFeed,
} from 'matrix-js-sdk/lib/webrtc/callFeed';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { User } from 'lucide-react';
import { matrixMemberDisplayLabel } from './matrix-room-member-display';

type HumanChatPanelCallStageProps = {
  client: MatrixClient | null;
  roomId: string | null;
  groupCall: GroupCall | null;
  callKind: 'audio' | 'video' | null;
  isLocalVideoMuted: boolean;
  isScreensharing: boolean;
  callState: string;
  feedVersion: number;
  currentUserId: string | null;
  resolveMemberLabel: (userId: string | undefined) => string;
};

function feedKey(feed: CallFeed, index: number): string {
  return `${feed.userId}:${String(feed.deviceId)}:${String(
    feed.purpose,
  )}:${index}`;
}

/**
 * Video grid + local PiP from GroupCall userMedia / screenshare feeds.
 * @see voice-video-call-implementation-spec.md §3.4.2, §3.5
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
  currentUserId,
  resolveMemberLabel,
}: HumanChatPanelCallStageProps) {
  const t = useTranslations('HumanChatPanel');
  const labelId = useId();
  const room: Room | null =
    roomId && client ? client.getRoom(roomId) ?? null : null;

  if (callState !== 'connected' || callKind !== 'video' || !groupCall) {
    return null;
  }

  const userMediaFeeds = [...groupCall.userMediaFeeds];
  const shareFeeds = [...groupCall.screenshareFeeds];

  const hasLocalWebcam = !isLocalVideoMuted;
  if (!hasLocalWebcam && shareFeeds.length === 0) {
    if (isScreensharing) {
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
    return null;
  }

  const remoteUserMedia = userMediaFeeds.filter((f) => !f.isLocal());
  const localUserMedia = userMediaFeeds.filter((f) => f.isLocal());
  const hasRemotesOrShare = shareFeeds.length > 0 || remoteUserMedia.length > 0;
  /** When alone in the room, show the local camera as the primary tile (not a tiny empty canvas + PiP). */
  const showLocalInMainGrid =
    !hasRemotesOrShare && localUserMedia.length > 0 && hasLocalWebcam;
  const showLocalPip = hasRemotesOrShare;

  return (
    <section
      className="relative w-full min-h-[min(32vh,200px)] max-w-full shrink-0 border-b border-border bg-muted/20 @container/call"
      role="region"
      aria-labelledby={labelId}
    >
      <h2 id={labelId} className="sr-only">
        {t('callStageLabel')}
      </h2>
      {(hasRemotesOrShare || showLocalInMainGrid) && (
        <div
          className={cn(
            'grid gap-2 p-2',
            '@min-[22rem]:grid-cols-2',
            shareFeeds.length +
              remoteUserMedia.length +
              (showLocalInMainGrid ? 1 : 0) ===
              1 && 'mx-auto max-w-2xl',
            shareFeeds.some(
              (f) => !f.isVideoMuted() && f.stream.getVideoTracks().length > 0,
            ) && 'min-h-[min(36vh,280px)]',
            !shareFeeds.length &&
              remoteUserMedia.length > 0 &&
              'min-h-[min(32vh,220px)]',
            showLocalInMainGrid && 'min-h-[min(32vh,240px)]',
          )}
          data-feed-tick={_feedVersion}
        >
          {shareFeeds.map((feed, i) => (
            <CallFeedTile
              key={feedKey(feed, i)}
              feed={feed}
              isShare
              room={room}
              currentUserId={currentUserId}
              resolveMemberLabel={resolveMemberLabel}
              t={t}
            />
          ))}
          {remoteUserMedia.map((feed, i) => (
            <CallFeedTile
              key={feedKey(feed, i)}
              feed={feed}
              room={room}
              currentUserId={currentUserId}
              resolveMemberLabel={resolveMemberLabel}
              t={t}
            />
          ))}
          {showLocalInMainGrid &&
            localUserMedia.map((feed, i) => (
              <CallFeedTile
                key={feedKey(feed, i)}
                feed={feed}
                room={room}
                currentUserId={currentUserId}
                resolveMemberLabel={resolveMemberLabel}
                t={t}
              />
            ))}
        </div>
      )}
      {localUserMedia.length > 0 && hasLocalWebcam && showLocalPip && (
        <div
          className="pointer-events-none absolute bottom-2 end-2 z-10 w-[32%] min-w-[5.5rem] max-w-[8.5rem] overflow-hidden rounded-lg border-2 border-border bg-card shadow-lg"
          style={{ aspectRatio: '4 / 3' }}
        >
          {localUserMedia.map((feed, i) => (
            <CallFeedTile
              key={feedKey(feed, i)}
              feed={feed}
              isPip
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
  room,
  currentUserId,
  resolveMemberLabel,
  t,
}: {
  feed: CallFeed;
  isShare?: boolean;
  isPip?: boolean;
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
      label={label}
      t={t}
    />
  );
};

const FeedContent = ({
  feed,
  isShare,
  isPip,
  label,
  t,
}: {
  feed: CallFeed;
  isShare: boolean;
  isPip: boolean;
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
    return () => {
      feed.removeListener(CallFeedEvent.MuteStateChanged, onFeedVisualChange);
      feed.removeListener(CallFeedEvent.NewStream, onFeedVisualChange);
    };
  }, [feed]);

  const hasVideo = !feed.isVideoMuted() && stream.getVideoTracks().length > 0;

  return (
    <div
      className={cn(
        'relative flex min-h-[10rem] min-w-0 items-stretch justify-center overflow-hidden rounded-lg bg-black/20',
        isShare && 'min-h-[14rem] @min-[22rem]:col-span-2',
        isPip && 'min-h-0',
      )}
    >
      {hasVideo ? (
        <>
          <video
            ref={ref}
            className={cn(
              'w-full object-contain',
              isPip ? 'max-h-24' : 'min-h-[10rem] max-h-[min(40vh,360px)]',
            )}
            autoPlay
            playsInline
            muted={feed.isLocal()}
            aria-label={label}
          />
          {!isPip && (
            <div className="absolute bottom-1 start-1 max-w-[90%] truncate rounded bg-background/80 px-1.5 py-0.5 text-xs">
              {label}
            </div>
          )}
        </>
      ) : (
        <div
          className="flex w-full min-h-[10rem] flex-col items-center justify-center gap-1 p-2 text-center"
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
