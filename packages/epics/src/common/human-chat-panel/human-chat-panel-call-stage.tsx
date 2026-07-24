'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useReducer,
  useRef,
  useState,
  type RefObject,
  type ReactNode,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import type { MatrixClient, Room as MatrixRoom } from 'matrix-js-sdk';
import type { Room as LiveKitRoom } from 'livekit-client';
import {
  CallFeedEvent,
  type CallFeed,
} from 'matrix-js-sdk/lib/webrtc/callFeed';
import { useTranslations } from 'next-intl';
import { cn } from '@hypha-platform/ui-utils';
import { Loader2, Maximize2, MicOff, User } from 'lucide-react';
import {
  shouldMirrorCallFeedVideoForDisplay,
  usePersonBySub,
  useUserPrivyIdByMatrixId,
  type SpaceGroupCallState,
} from '@hypha-platform/core/client';
import { Skeleton, useIsMobile } from '@hypha-platform/ui';
import {
  matrixMemberDisplayLabel,
  matrixUserIdToCanonicalPrivySub,
  needsHyphaProfileResolutionForMatrixLabel,
  looksLikeTechnicalMatrixDisplayName,
} from './matrix-room-member-display';
import {
  CALL_FEED_VIDEO_LABEL_CHIP_TONE_CLASS,
  CALL_FEED_VIDEO_LABEL_NAME_CLASS,
  resolveCallFeedAudioScrimLayout,
  resolveCallFeedVideoParticipantLabelLayout,
} from './call-feed-tile-chrome';
import { CallAudioVoiceWaves } from './call-audio-voice-waves';
import {
  CALL_PARTICIPANT_PROFILE_TIMEOUT_MS,
  resolveCallParticipantDisplayText,
  shouldShowCallParticipantNameSkeleton,
} from './call-participant-display-name';
import type { CallFullViewLayoutMode } from './call-full-view-layout';
import { CallFullViewPaneSplitter } from './human-chat-panel-call-full-view-pane-splitter';
import type { CallFullViewPaneSplit } from './call-full-view-split';
import {
  CALL_GALLERY_MAX_TILES_PER_PAGE,
  computeCallGalleryGrid,
  getCallGalleryPageCount,
  getCallGalleryTileColumnStart,
  callGalleryGridStyle,
  sliceCallGalleryPage,
  type CallGalleryGridLayout,
} from './call-gallery-grid';
import { CallDockAspectTileShell } from './call-dock-tile-shell';
import { CallPresenterParticipantFilmstrip } from './call-presenter-participant-filmstrip';
import { CALL_DOCUMENT_PIP_FILMSTRIP_WIDTH } from './call-document-pip-window-geometry';
import { resolveScreenshareFilmstripContentWidth } from './call-screenshare-filmstrip-geometry';
import {
  resolveCallStageLayout,
  resolveShareParticipantBandLayout,
  resolveSpeakerPrimaryStripIndices,
  type CallGalleryTilePlacement,
  type CallViewportTier,
} from './call-stage-layout-engine';
import {
  resolveCallStageShareLayout,
  shareFeedLayoutKey,
} from './call-stage-share-layout';
import {
  CALL_PANEL_MOBILE_PAGINATED_MIN,
  getCallPanelMobileGridLayout,
} from './call-panel-mobile-grid';
import {
  feedReportsAudioMutedForTile,
  formatCallShareTileLabel,
  resolveCallAudioPortalTarget,
  shouldMountRemoteCallAudioSink,
} from './call-feed-tile-audio';
import {
  createCallFeedVideoStream,
  hasWarmingCallFeedVideoTrack,
  isCallFeedVideoSurfaceReady,
  resolveCallFeedLiveVideoTrack,
  resolveCallFeedVideoSurfaceClassName,
} from './call-feed-tile-video';
import { registerCallPlaybackElement } from './call-playback-registry';
import { callAccentAlertOnDarkText } from './call-accent-alert-styles';
import { CallFloatingReactionOverlay } from './call-floating-reaction-overlay';
import { CallRaiseHandBadge } from './call-raise-hand-badge';
import {
  buildCallFeedsFromLiveKitRoom,
  feedKeyForActive,
} from './call-livekit-feed-adapter';
import type { CallFloatingReaction } from './use-call-reactions';

export type HumanChatPanelCallStageLayout = 'panel' | 'fullView' | 'hidden';

type HumanChatPanelCallStageBaseProps = {
  client: MatrixClient | null;
  roomId: string | null;
  liveKitRoom: LiveKitRoom | null;
  callKind: 'audio' | 'video' | null;
  isLocalVideoMuted: boolean;
  /** GroupCall mic mute — use for local tiles (CallFeed often has no audio tracks on camera feed). */
  isMicrophoneMuted?: boolean;
  isScreensharing: boolean;
  callState: SpaceGroupCallState;
  feedVersion: number;
  activeSpeakerKey: string | null;
  currentUserId: string | null;
  resolveMemberLabel: (userId: string | undefined) => string;
  /** App profile / DB avatar for the signed-in user (for local tile when no Matrix avatar). */
  currentUserProfileAvatarUrl?: string | null;
  /**
   * Matrix `m.call.*` / GroupCall `participants` (room state) can list others before
   * `userMediaFeeds` get a WebRTC `CallFeed`. Used to show placeholder tiles so the
   * stage matches the member count (§ Hypha: avoid “2 members, 1 tile”).
   */
  inCallUserIds?: string[] | null;
  /** True when remote participant map has users but feeds never attached (show stall copy). */
  remoteMediaStall?: boolean;
  getFloatingReactions?: (
    userId: string | null | undefined,
  ) => CallFloatingReaction[];
  isHandRaised?: (userId: string | null | undefined) => boolean;
  getRaiseHandOrder?: (userId: string | null | undefined) => number | null;
  /** Bumps when floating reaction overlays change. */
  floatingReactionsVersion?: number;
};

type HumanChatPanelCallStageProps = HumanChatPanelCallStageBaseProps & {
  layout: HumanChatPanelCallStageLayout;
  /** In panel layout, choose between immersive crop (`cover`) and full-frame (`contain`). */
  panelVideoFit?: 'cover' | 'contain';
  /** Edge-to-edge tiles (global call dock): no inset padding or rounded tile corners. */
  panelFlush?: boolean;
  /** Shown in panel when full view is available; opens the enlarged dialog. */
  onRequestFullView?: () => void;
  /** `true` when the app-level full-view dialog is open; hides the inline stage so one video tree remains mounted. */
  fullViewOpen?: boolean;
  /** `ref` for the expand trigger (return focus on dialog close; Radix handles this if this ref is the trigger). */
  fullViewTriggerRef?: RefObject<HTMLButtonElement | null>;
  /**
   * Screen-share + camera layout in the full-view dialog (§3.4.4.2–3).
   * Ignored when `layout !== 'fullView'`.
   */
  fullViewLayoutMode?: CallFullViewLayoutMode;
  /**
   * Draggable pane ratios (0–1) for screen share vs participants. Persisted in parent.
   * Ignored when `layout !== 'fullView'`.
   */
  fullViewPaneSplit?: {
    sideBySide: number;
    filmstrip: number;
    speakerOnTop: number;
  };
  onFullViewPaneSplitChange?: (
    which: CallFullViewPaneSplit,
    value: number,
  ) => void;
  /** Document PiP open — remote audio sinks mount on the main page (WCUX-PIP-1). */
  isDocumentPipOpen?: boolean;
  /** Dock viewport tier (WCUX-LAYOUT-0); inferred from layout when omitted. */
  viewportTier?: CallViewportTier;
  /**
   * Parent-known phone layout (e.g. global dock). Avoids waiting on
   * {@link useIsMobile} hydration before applying the balanced mobile grid.
   */
  panelMobileLayout?: boolean;
};

function feedKey(feed: CallFeed, index: number): string {
  return `${feed.userId}:${String(feed.deviceId)}:${String(
    feed.purpose,
  )}:${index}`;
}

type RemoteTileItem =
  | { kind: 'feed'; feed: CallFeed }
  | { kind: 'placeholder'; userId: string };

function buildRemoteUserTiles(
  remoteFeeds: CallFeed[],
  missingUserIds: string[],
): RemoteTileItem[] {
  const out: RemoteTileItem[] = remoteFeeds.map((f) => ({
    kind: 'feed',
    feed: f,
  }));
  for (const id of missingUserIds) {
    out.push({ kind: 'placeholder', userId: id });
  }
  return out;
}

function galleryTileKey(item: RemoteTileItem, index: number): string {
  return item.kind === 'feed'
    ? feedKey(item.feed, index)
    : `ph-gallery-${item.userId}-${index}`;
}

type CallParticipantGalleryGridProps = {
  tiles: RemoteTileItem[];
  isFull: boolean;
  /** Override balanced grid column cap (defaults to 5 full-view / 2 panel). */
  maxCols?: number;
  /** Override computed gallery grid (threshold layouts). */
  galleryLayout?: CallGalleryGridLayout;
  tilePlacements?: CallGalleryTilePlacement[];
  galleryPage: number;
  onGalleryPageChange: (page: number) => void;
  showPagination: boolean;
  keyPrefix: number;
  cellClassName: string;
  className?: string;
  renderTile: (item: RemoteTileItem, keyIdx: number) => ReactNode;
  pageLabel: (current: number, total: number) => string;
  previousPageLabel: string;
  nextPageLabel: string;
};

function callGalleryTilePlacementStyle(
  placement: CallGalleryTilePlacement | undefined,
): CSSProperties | undefined {
  if (!placement) return undefined;
  const style: CSSProperties = {};
  if (placement.gridColumnStart != null) {
    style.gridColumnStart = placement.gridColumnStart;
  }
  if (placement.gridColumnEnd != null) {
    style.gridColumnEnd = placement.gridColumnEnd;
  }
  if (placement.gridRowStart != null) {
    style.gridRowStart = placement.gridRowStart;
  }
  if (placement.gridRowEnd != null) {
    style.gridRowEnd = placement.gridRowEnd;
  }
  return Object.keys(style).length > 0 ? style : undefined;
}

function CallParticipantGalleryGrid({
  tiles,
  isFull,
  maxCols,
  galleryLayout: galleryLayoutOverride,
  tilePlacements,
  galleryPage,
  onGalleryPageChange,
  showPagination,
  keyPrefix,
  cellClassName,
  className,
  renderTile,
  pageLabel,
  previousPageLabel,
  nextPageLabel,
}: CallParticipantGalleryGridProps) {
  const pageSize = CALL_GALLERY_MAX_TILES_PER_PAGE;
  const visibleTiles = showPagination
    ? sliceCallGalleryPage(tiles, galleryPage, pageSize)
    : tiles;
  const colCap = maxCols ?? (isFull ? 5 : 2);
  const layout =
    galleryLayoutOverride ??
    computeCallGalleryGrid(visibleTiles.length, colCap);
  const pageCount = getCallGalleryPageCount(tiles.length, pageSize);
  const fullGridStyle = callGalleryGridStyle(layout);
  const dockPanel = !isFull;
  const gridStyle = dockPanel
    ? { gridTemplateColumns: fullGridStyle.gridTemplateColumns }
    : fullGridStyle;

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col',
        dockPanel ? 'overflow-y-auto overscroll-contain' : 'overflow-hidden',
        className,
      )}
    >
      <div
        className={cn(
          'grid w-full min-w-0 gap-1.5',
          dockPanel
            ? 'min-h-0 flex-1 content-start [grid-auto-rows:auto]'
            : 'min-h-0 flex-1 content-stretch items-stretch [grid-auto-rows:minmax(0,1fr)]',
        )}
        style={gridStyle}
      >
        {visibleTiles.map((item, i) => {
          const tileIndex = showPagination ? galleryPage * pageSize + i : i;
          const placement =
            tilePlacements?.find((entry) => entry.index === tileIndex) ??
            tilePlacements?.[tileIndex];
          const colStart =
            placement?.gridColumnStart ??
            getCallGalleryTileColumnStart(i, visibleTiles.length, layout);
          const placementStyle = callGalleryTilePlacementStyle(placement);
          const rowSpan =
            placement?.gridRowStart != null && placement?.gridRowEnd != null
              ? placement.gridRowEnd - placement.gridRowStart
              : 1;
          const tile = renderTile(item, keyPrefix + i);
          return (
            <div
              key={galleryTileKey(item, keyPrefix + i)}
              className={cn(
                cellClassName,
                dockPanel && rowSpan > 1 && 'min-h-0 self-stretch',
              )}
              style={
                placementStyle ??
                (colStart ? { gridColumnStart: colStart } : undefined)
              }
            >
              {dockPanel ? (
                <CallDockAspectTileShell
                  sizing={rowSpan > 1 ? 'fit' : 'width'}
                  className={rowSpan > 1 ? 'h-full' : undefined}
                >
                  {tile}
                </CallDockAspectTileShell>
              ) : (
                tile
              )}
            </div>
          );
        })}
      </div>
      {showPagination && pageCount > 1 ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border/30 px-2 py-1.5 text-xs text-zinc-300">
          <button
            type="button"
            className="rounded-md border border-border/40 px-2 py-0.5 transition hover:bg-white/10 disabled:opacity-40"
            disabled={galleryPage <= 0}
            onClick={() => onGalleryPageChange(Math.max(0, galleryPage - 1))}
            aria-label={previousPageLabel}
          >
            ‹
          </button>
          <span aria-live="polite">
            {pageLabel(galleryPage + 1, pageCount)}
          </span>
          <button
            type="button"
            className="rounded-md border border-border/40 px-2 py-0.5 transition hover:bg-white/10 disabled:opacity-40"
            disabled={galleryPage >= pageCount - 1}
            onClick={() =>
              onGalleryPageChange(Math.min(pageCount - 1, galleryPage + 1))
            }
            aria-label={nextPageLabel}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}

type CallSpeakerPrimaryStripProps = {
  tiles: RemoteTileItem[];
  activeSpeakerIndex: number;
  speakerPrimaryRatio: number;
  stripMaxVisible: number;
  className?: string;
  cellClassName: string;
  renderTile: (item: RemoteTileItem, keyIdx: number) => ReactNode;
  overflowLabel: (count: number) => string;
  isPortrait?: boolean;
  /** Resizable dock panel — preserve 16:9 tiles; scroll strip instead of clipping. */
  panelDock?: boolean;
  /** Direction of the non-speaker strip itself (independent of the speaker/strip split axis). */
  stripDirection?: 'row' | 'col';
  stripPage?: number;
  onStripPageChange?: (page: number) => void;
  showStripPagination?: boolean;
  pageLabel?: (current: number, total: number) => string;
  previousPageLabel?: string;
  nextPageLabel?: string;
};

function CallSpeakerPrimaryStrip({
  tiles,
  activeSpeakerIndex,
  speakerPrimaryRatio,
  stripMaxVisible,
  className,
  cellClassName,
  renderTile,
  overflowLabel,
  isPortrait = false,
  panelDock = false,
  stripDirection = 'col',
  stripPage = 0,
  onStripPageChange,
  showStripPagination = false,
  pageLabel,
  previousPageLabel,
  nextPageLabel,
}: CallSpeakerPrimaryStripProps) {
  const { speakerIndex, stripIndices, overflowCount, stripPageCount } =
    resolveSpeakerPrimaryStripIndices(
      tiles.length,
      activeSpeakerIndex,
      stripMaxVisible,
      stripPage,
      showStripPagination,
    );
  const speakerTile = tiles[speakerIndex];
  const stripTiles = stripIndices
    .map((index) => ({ index, item: tiles[index] }))
    .filter((entry): entry is { index: number; item: RemoteTileItem } =>
      Boolean(entry.item),
    );
  /** One thumbnail in the strip (N=2 dock): fill column height instead of letterboxing with void. */
  const singleStripTileInDock = panelDock && stripTiles.length === 1;

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
        className,
      )}
    >
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden',
          panelDock && 'min-h-[5.5rem]',
          isPortrait ? 'flex-col' : 'flex-row',
        )}
      >
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col',
            panelDock && 'min-h-[4.5rem] flex-1',
            cellClassName,
          )}
          style={{ flex: `${speakerPrimaryRatio} 1 0%` }}
        >
          {speakerTile ? (
            panelDock ? (
              <CallDockAspectTileShell className="h-full min-h-[4.5rem]">
                {renderTile(speakerTile, speakerIndex)}
              </CallDockAspectTileShell>
            ) : (
              renderTile(speakerTile, speakerIndex)
            )
          ) : null}
        </div>
        <div
          className={cn(
            'min-h-0 min-w-0 gap-1.5 overscroll-contain',
            panelDock
              ? singleStripTileInDock
                ? 'flex min-h-0 flex-1 flex-col'
                : stripDirection === 'row'
                ? 'flex flex-row overflow-x-auto'
                : 'flex flex-col overflow-y-auto'
              : stripDirection === 'row'
              ? 'flex flex-row overflow-x-auto'
              : 'flex flex-col overflow-y-auto',
            cellClassName,
          )}
          style={{ flex: `${1 - speakerPrimaryRatio} 1 0%` }}
        >
          {stripTiles.map(({ item, index }) => (
            <div
              key={galleryTileKey(item, index)}
              className={cn(
                panelDock
                  ? singleStripTileInDock
                    ? 'flex min-h-0 min-w-0 flex-1 flex-col'
                    : 'min-w-0 shrink-0'
                  : 'relative min-h-0 w-full min-w-0 flex-1 overflow-hidden',
              )}
            >
              {panelDock ? (
                <CallDockAspectTileShell
                  sizing={singleStripTileInDock ? 'fit' : 'width'}
                  className={
                    singleStripTileInDock ? 'h-full min-h-0 flex-1' : undefined
                  }
                >
                  {renderTile(item, index)}
                </CallDockAspectTileShell>
              ) : (
                <div className="absolute inset-0 min-h-0 min-w-0">
                  {renderTile(item, index)}
                </div>
              )}
            </div>
          ))}
          {overflowCount > 0 ? (
            <div className="flex min-h-[1.75rem] items-center justify-center rounded-md bg-background/80 px-2 text-xs text-zinc-200">
              {overflowLabel(overflowCount)}
            </div>
          ) : null}
        </div>
      </div>
      {showStripPagination &&
      stripPageCount > 1 &&
      onStripPageChange &&
      pageLabel &&
      previousPageLabel &&
      nextPageLabel ? (
        <div className="flex shrink-0 items-center justify-center gap-2 border-t border-border/30 px-2 py-1.5 text-xs text-zinc-300">
          <button
            type="button"
            className="rounded-md border border-border/40 px-2 py-0.5 transition hover:bg-white/10 disabled:opacity-40"
            disabled={stripPage <= 0}
            onClick={() => onStripPageChange(Math.max(0, stripPage - 1))}
            aria-label={previousPageLabel}
          >
            ‹
          </button>
          <span aria-live="polite">
            {pageLabel(stripPage + 1, stripPageCount)}
          </span>
          <button
            type="button"
            className="rounded-md border border-border/40 px-2 py-0.5 transition hover:bg-white/10 disabled:opacity-40"
            disabled={stripPage >= stripPageCount - 1}
            onClick={() =>
              onStripPageChange(Math.min(stripPageCount - 1, stripPage + 1))
            }
            aria-label={nextPageLabel}
          >
            ›
          </button>
        </div>
      ) : null}
    </div>
  );
}

/** Room member Matrix avatar → HTTP for `<img>` in call tiles (no media auth). */
function matrixMemberAvatarSquareForCall(
  client: MatrixClient | null,
  roomId: string | null,
  userId: string | undefined,
  px: number,
): string | undefined {
  if (!client || !roomId || !userId) return undefined;
  const room = client.getRoom(roomId);
  const member = room?.getMember(userId);
  if (!member) return undefined;
  const mxc = member.getMxcAvatarUrl();
  if (!mxc || !mxc.startsWith('mxc://')) return undefined;
  return (
    client.mxcUrlToHttp(mxc, px, px, 'crop', true, false, false) ?? undefined
  );
}

type CallStageContentModelFields = {
  isVideoCall: boolean;
  userMediaFeeds: CallFeed[];
  shareFeeds: CallFeed[];
  hasLocalWebcam: boolean;
  remoteUserMedia: CallFeed[];
  /** Room state knows they’re in the call; WebRTC feed not attached yet. */
  missingRemoteUserIds: string[];
  localUserMedia: CallFeed[];
  hasRemotesOrShare: boolean;
  showLocalInMainGrid: boolean;
  showLocalPip: boolean;
};

export type CallStageContentModel =
  | ({ kind: 'screenSharePendingStrip' } & CallStageContentModelFields)
  | ({ kind: 'main' } & CallStageContentModelFields);

type CallStageMainModel = Extract<CallStageContentModel, { kind: 'main' }>;

/**
 * Feeds the same gating as {@link HumanChatPanelCallStage} to decide if the
 * enlarged (modal) call view is meaningful — not for the "screen share is on" text strip alone.
 */
export function getHumanChatPanelCallStageModel(
  liveKitRoom: LiveKitRoom | null,
  callKind: 'audio' | 'video' | null,
  isLocalVideoMuted: boolean,
  isScreensharing: boolean,
  callState: SpaceGroupCallState,
  currentUserId: string | null = null,
  inCallUserIds: string[] | null = null,
): CallStageContentModel | null {
  if (callState !== 'connected' || !liveKitRoom) {
    return null;
  }
  if (callKind !== 'video' && callKind !== 'audio') {
    return null;
  }

  const { userMediaFeeds, screenshareFeeds: shareFeeds } =
    buildCallFeedsFromLiveKitRoom(liveKitRoom);
  const isVideoCall = callKind === 'video';
  const hasLocalWebcam = isVideoCall && !isLocalVideoMuted;

  /**
   * While display capture is starting, `screenshareFeeds` can be empty briefly — panel
   * shows a thin line; the full min-frame (avatar + share) appears once the feed exists.
   */
  if (
    isVideoCall &&
    !hasLocalWebcam &&
    shareFeeds.length === 0 &&
    isScreensharing
  ) {
    return {
      kind: 'screenSharePendingStrip',
      isVideoCall,
      userMediaFeeds,
      shareFeeds,
      hasLocalWebcam,
      remoteUserMedia: [],
      missingRemoteUserIds: [],
      localUserMedia: [],
      hasRemotesOrShare: false,
      showLocalInMainGrid: false,
      showLocalPip: false,
    };
  }

  const remoteUserMedia = userMediaFeeds.filter((f) => !f.isLocal());
  const localUserMedia = userMediaFeeds.filter((f) => f.isLocal());
  const seenInFeeds = new Set<string>();
  for (const f of userMediaFeeds) {
    if (f.userId) seenInFeeds.add(f.userId);
  }
  const missingRemoteUserIds: string[] = [];
  for (const id of inCallUserIds ?? []) {
    if (!id || id === currentUserId) continue;
    if (seenInFeeds.has(id)) continue;
    missingRemoteUserIds.push(id);
  }
  const hasRemotesOrShare =
    shareFeeds.length > 0 ||
    remoteUserMedia.length > 0 ||
    missingRemoteUserIds.length > 0;
  /** Solo in room: show local tile whenever we have a local user-media feed — video, camera-off, or audio-only (avatar + waves). */
  const showLocalInMainGrid = !hasRemotesOrShare && localUserMedia.length > 0;
  const showLocalPip = false;
  return {
    kind: 'main',
    isVideoCall,
    userMediaFeeds,
    shareFeeds,
    hasLocalWebcam,
    remoteUserMedia,
    missingRemoteUserIds,
    localUserMedia,
    hasRemotesOrShare,
    showLocalInMainGrid,
    showLocalPip,
  };
}

/** `true` when a full-size stage (grid / tiles) is on screen — user may open the enlarged dialog. */
export function canOpenHumanChatCallFullView(
  liveKitRoom: LiveKitRoom | null,
  callKind: 'audio' | 'video' | null,
  isLocalVideoMuted: boolean,
  isScreensharing: boolean,
  callState: SpaceGroupCallState,
  currentUserId?: string | null,
  inCallUserIds?: string[] | null,
): boolean {
  const m = getHumanChatPanelCallStageModel(
    liveKitRoom,
    callKind,
    isLocalVideoMuted,
    isScreensharing,
    callState,
    currentUserId ?? null,
    inCallUserIds ?? null,
  );
  return m?.kind === 'main';
}

function CallScreenSharePendingStrip({
  layout,
}: {
  layout: HumanChatPanelCallStageLayout;
}) {
  const t = useTranslations('HumanChatPanel');
  if (layout === 'fullView') return null;
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

type HumanChatPanelCallStageMainProps = HumanChatPanelCallStageProps & {
  model: CallStageMainModel;
};

/**
 * Video grid + local PiP from GroupCall userMedia / screenshare feeds.
 * Use `layout: 'panel' | 'fullView' | 'hidden'`: mount **one** instance with
 * `fullView` when the modal is open, and `hidden` in the panel so streams stay
 * single-sourced (spec §3.4.4).
 * @see voice-video-call-implementation-spec.md §3.4.2, §3.4.4, §3.5
 */
export function HumanChatPanelCallStage(props: HumanChatPanelCallStageProps) {
  const model = getHumanChatPanelCallStageModel(
    props.liveKitRoom,
    props.callKind,
    props.isLocalVideoMuted,
    props.isScreensharing,
    props.callState,
    props.currentUserId,
    props.inCallUserIds,
  );

  if (!model) return null;
  if (model.kind === 'screenSharePendingStrip') {
    return <CallScreenSharePendingStrip layout={props.layout} />;
  }
  if (props.layout === 'hidden') return null;
  if (model.kind !== 'main') return null;

  return <HumanChatPanelCallStageMain {...props} model={model} />;
}

function HumanChatPanelCallStageMain({
  model,
  client,
  roomId,
  liveKitRoom: _liveKitRoom,
  callKind: _callKind,
  isLocalVideoMuted,
  isMicrophoneMuted,
  isScreensharing,
  callState: _callState,
  feedVersion: _feedVersion,
  activeSpeakerKey,
  currentUserId,
  resolveMemberLabel,
  currentUserProfileAvatarUrl = null,
  inCallUserIds: _inCallUserIds = null,
  remoteMediaStall = false,
  layout,
  panelVideoFit = 'cover',
  panelFlush = false,
  onRequestFullView,
  fullViewOpen = false,
  fullViewTriggerRef,
  fullViewLayoutMode = 'filmstrip',
  fullViewPaneSplit = {
    sideBySide: 0.68,
    filmstrip: 0.72,
    speakerOnTop: 0.28,
  },
  onFullViewPaneSplitChange,
  isDocumentPipOpen = false,
  viewportTier: viewportTierProp,
  panelMobileLayout: panelMobileLayoutProp,
  getFloatingReactions,
  isHandRaised,
  getRaiseHandOrder,
  floatingReactionsVersion = 0,
}: HumanChatPanelCallStageMainProps) {
  const t = useTranslations('HumanChatPanel');
  const labelId = useId();
  const [galleryPage, setGalleryPage] = useState(0);
  const localSplitRef = useRef<HTMLDivElement | null>(null);
  /** Pane split math must use the share/participant flex wrapper, not the outer dock shell. */
  const splitRef = localSplitRef;
  const onSplit = onFullViewPaneSplitChange;
  const handleExpand = useCallback(() => {
    onRequestFullView?.();
  }, [onRequestFullView]);

  const remoteUserTiles = useMemo(
    () =>
      buildRemoteUserTiles(model.remoteUserMedia, model.missingRemoteUserIds),
    [model.missingRemoteUserIds, model.remoteUserMedia],
  );
  const {
    isVideoCall,
    shareFeeds: rawShareFeeds,
    hasLocalWebcam,
    remoteUserMedia,
    missingRemoteUserIds,
    localUserMedia,
    showLocalInMainGrid: rawShowLocalInMainGrid,
    showLocalPip: rawShowLocalPip,
  } = model;

  const isFull = layout === 'fullView';
  const isMobileViewport = useIsMobile() ?? false;
  const isPhonePanelLayout = panelMobileLayoutProp ?? isMobileViewport;
  /** Phone-width in-panel call (floating dock or sidebar) — not tablet/desktop full view. */
  const isMobilePanelStage =
    layout === 'panel' && !isFull && isPhonePanelLayout;
  const resolvedViewportTier: CallViewportTier =
    viewportTierProp ?? (isFull ? 'V-L' : isDocumentPipOpen ? 'V-PiP' : 'V-M');
  /**
   * Mobile panel keeps dock-tier layout rules even when the dock is fullscreen
   * (Chrome reports V-L otherwise → threshold gallery + black void on 2-up).
   */
  const layoutViewportTier: CallViewportTier =
    isMobilePanelStage && !isDocumentPipOpen ? 'V-S' : resolvedViewportTier;
  const {
    shareFeeds,
    localShareActive,
    presenterShareOnly,
    hasRenderableShare,
    hasPendingRemoteShare,
  } = resolveCallStageShareLayout({
    rawShareFeeds,
    isScreensharing,
    isVideoCall,
  });
  const hasRemotesOrShare =
    remoteUserMedia.length > 0 ||
    missingRemoteUserIds.length > 0 ||
    hasRenderableShare;
  const showLocalInMainGrid =
    rawShowLocalInMainGrid || (!hasRemotesOrShare && localUserMedia.length > 0);
  const showLocalPip = rawShowLocalPip && hasRemotesOrShare;
  /** Tiles visible in the main participant grid (local always included — corner PiP disabled). */
  const layoutParticipantTiles = useMemo(() => {
    const tiles: RemoteTileItem[] = [...remoteUserTiles];
    const localFeed = localUserMedia[0];
    if (localFeed) {
      const hasLocal = tiles.some(
        (item) => item.kind === 'feed' && item.feed.isLocal(),
      );
      if (!hasLocal) {
        tiles.push({ kind: 'feed', feed: localFeed });
      }
    }
    return tiles;
  }, [localUserMedia, remoteUserTiles]);
  const activeShareLayoutKey = shareFeedLayoutKey(rawShareFeeds);
  const shareLayoutResetKey = [
    activeShareLayoutKey,
    localShareActive ? 'local' : '',
    presenterShareOnly ? 'presenter' : '',
    hasPendingRemoteShare ? 'pending' : '',
  ].join('|');

  const activeSpeakerIndex = useMemo(() => {
    if (!activeSpeakerKey) return 0;
    const idx = layoutParticipantTiles.findIndex(
      (item) =>
        item.kind === 'feed' &&
        feedKeyForActive(item.feed) === activeSpeakerKey,
    );
    return idx >= 0 ? idx : 0;
  }, [activeSpeakerKey, layoutParticipantTiles]);

  const layoutPlan = useMemo(
    () =>
      resolveCallStageLayout({
        viewportTier: layoutViewportTier,
        participantDeviceCount: layoutParticipantTiles.length,
        hasActiveShare: hasRenderableShare || isScreensharing,
        activeSpeakerIndex,
        galleryPage,
      }),
    [
      layoutViewportTier,
      layoutParticipantTiles.length,
      hasRenderableShare,
      isScreensharing,
      activeSpeakerIndex,
      galleryPage,
    ],
  );

  useEffect(() => {
    setGalleryPage(0);
  }, [layoutPlan.galleryPaginationResetKey, shareLayoutResetKey]);

  const effectivePanelVideoFit =
    layout === 'panel' && !isFull
      ? layoutPlan.participantVideoFit
      : panelVideoFit;
  const userGridTileCount =
    remoteUserMedia.length +
    missingRemoteUserIds.length +
    (showLocalInMainGrid ? localUserMedia.length : 0);
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
  /** Same tile list as speaker strip / gallery (includes local when in-call). */
  const participantGridTileCount = layoutParticipantTiles.length;
  const mobilePanelGrid =
    isMobilePanelStage &&
    participantGridTileCount > 0 &&
    participantGridTileCount < CALL_PANEL_MOBILE_PAGINATED_MIN
      ? getCallPanelMobileGridLayout(participantGridTileCount)
      : null;

  const room: MatrixRoom | null =
    roomId && client ? client.getRoom(roomId) ?? null : null;

  const showExpand =
    layout === 'panel' &&
    !fullViewOpen &&
    !isDocumentPipOpen &&
    !isScreensharing &&
    onRequestFullView;

  const shareParticipantTiles = useMemo(() => {
    /** Presenter dock: all in-call tiles (feeds + placeholders + local). */
    if (presenterShareOnly) {
      return layoutParticipantTiles;
    }
    const out: RemoteTileItem[] = [...remoteUserTiles];
    const localFeed = localUserMedia[0];
    if (showLocalPip && localFeed) {
      const hasLocal = out.some(
        (x) => x.kind === 'feed' && x.feed.isLocal() && x.feed === localFeed,
      );
      if (!hasLocal) {
        out.push({ kind: 'feed', feed: localFeed });
      }
    }
    return out;
  }, [
    layoutParticipantTiles,
    presenterShareOnly,
    remoteUserTiles,
    showLocalPip,
    localUserMedia,
  ]);

  const shareBandLayout = resolveShareParticipantBandLayout(
    shareParticipantTiles.length,
  );
  const shareDuoGalleryLayout = useMemo(() => computeCallGalleryGrid(2, 2), []);

  const shareActiveSpeakerIndex = useMemo(() => {
    if (!activeSpeakerKey) return 0;
    const idx = shareParticipantTiles.findIndex(
      (item) =>
        item.kind === 'feed' &&
        feedKeyForActive(item.feed) === activeSpeakerKey,
    );
    return idx >= 0 ? idx : 0;
  }, [activeSpeakerKey, shareParticipantTiles]);

  const useShareWithParticipantsLayout =
    (hasRenderableShare || isScreensharing) && shareParticipantTiles.length > 0;
  const effectiveShareLayoutMode: CallFullViewLayoutMode = isFull
    ? fullViewLayoutMode
    : 'sideBySide';
  /**
   * Phone panel + screen share: stack share above participants. Side-by-side +
   * pane splitter leaves a narrow column, emerald divider, and black voids.
   */
  const useMobileShareStackLayout =
    isMobilePanelStage && useShareWithParticipantsLayout && !presenterShareOnly;
  const sharePanelVideoFit: 'cover' | 'contain' = isMobilePanelStage
    ? 'contain'
    : effectivePanelVideoFit;

  /**
   * Phone panel: equal-height grid (see call-panel-mobile-grid) instead of
   * speaker-primary strip — strip leaves unused vertical space on narrow docks.
   */
  const useMobilePaginatedParticipantGallery =
    isMobilePanelStage &&
    !useShareWithParticipantsLayout &&
    participantGridTileCount >= CALL_PANEL_MOBILE_PAGINATED_MIN;
  const useMobileBalancedParticipantGrid =
    mobilePanelGrid != null &&
    !useShareWithParticipantsLayout &&
    !useMobilePaginatedParticipantGallery;
  const useSpeakerStripLayout =
    !useShareWithParticipantsLayout &&
    !useMobileBalancedParticipantGrid &&
    !useMobilePaginatedParticipantGallery &&
    !isScreensharing &&
    layoutPlan.renderer === 'speakerPrimaryStrip';

  const useMainGalleryLayout =
    !useShareWithParticipantsLayout &&
    !useMobileBalancedParticipantGrid &&
    !useMobilePaginatedParticipantGallery &&
    (layoutPlan.renderer === 'thresholdGallery' ||
      layoutPlan.renderer === 'paginatedGallery');

  const shareMobilePanelGrid =
    isMobilePanelStage &&
    shareParticipantTiles.length > 0 &&
    shareParticipantTiles.length < CALL_PANEL_MOBILE_PAGINATED_MIN
      ? getCallPanelMobileGridLayout(shareParticipantTiles.length)
      : null;

  const useShareParticipantGallery =
    useShareWithParticipantsLayout && shareBandLayout === 'gallery';
  const useShareParticipantDuo =
    useShareWithParticipantsLayout && shareBandLayout === 'duo';
  const useShareParticipantSpeakerStrip =
    useShareWithParticipantsLayout && shareBandLayout === 'speakerStrip';
  const useShareParticipantGridBand =
    useShareParticipantGallery || useShareParticipantDuo;

  /** One camera tile only, no share: flex column fill (no empty grid track / FV-1). */
  const useFullViewSingleMainTile =
    !useShareWithParticipantsLayout && layoutPlan.renderer === 'soloTile';
  const centerSoloTileInStage =
    useFullViewSingleMainTile &&
    (isDocumentPipOpen || (!isFull && userGridTileCount <= 1));

  /** Corner self-view PiP disabled — local tile stays in the main grid. */
  const showFloatingLocalPip = false;

  const speakerFeedForTopMode = (() => {
    if (remoteUserMedia.length > 0) {
      if (activeSpeakerKey) {
        const m = remoteUserMedia.find(
          (f) => feedKeyForActive(f) === activeSpeakerKey,
        );
        if (m) return m;
      }
      return remoteUserMedia[0] ?? null;
    }
    return localUserMedia[0] ?? null;
  })();
  const speakerTopPlaceholderId =
    !speakerFeedForTopMode && missingRemoteUserIds[0]
      ? missingRemoteUserIds[0]
      : null;

  const reactionPropsForFeed = (feed: CallFeed) => ({
    floatingReactions: getFloatingReactions?.(feed.userId) ?? [],
    handRaised: isHandRaised?.(feed.userId) ?? false,
    raiseHandOrder: getRaiseHandOrder?.(feed.userId) ?? null,
  });

  const renderUserTile = (feed: CallFeed, keyIdx: number) => (
    <CallFeedTile
      key={`${feedKey(feed, keyIdx)}:${floatingReactionsVersion}`}
      client={client}
      roomId={roomId}
      currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
      feed={feed}
      panelMobileLayout={isPhonePanelLayout}
      isFullView={isFull}
      isActiveSpeaker={
        activeSpeakerKey != null && activeSpeakerKey === feedKeyForActive(feed)
      }
      panelVideoFit={effectivePanelVideoFit}
      panelFlush={panelFlush}
      room={room}
      currentUserId={currentUserId}
      resolveMemberLabel={resolveMemberLabel}
      isMicrophoneMuted={isMicrophoneMuted}
      isLocalVideoMuted={isLocalVideoMuted}
      isDocumentPipOpen={isDocumentPipOpen}
      {...reactionPropsForFeed(feed)}
      t={t}
    />
  );

  const renderRemoteUserTile = (item: RemoteTileItem, keyIdx: number) =>
    item.kind === 'feed' ? (
      renderUserTile(item.feed, keyIdx)
    ) : (
      <CallParticipantPlaceholderTile
        key={`ph-${item.userId}-${keyIdx}`}
        client={client}
        roomId={roomId}
        userId={item.userId}
        currentUserId={currentUserId}
        currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
        isFullView={isFull}
        isPip={false}
        resolveMemberLabel={resolveMemberLabel}
        remoteMediaStall={remoteMediaStall}
        handRaised={isHandRaised?.(item.userId) ?? false}
        raiseHandOrder={getRaiseHandOrder?.(item.userId) ?? null}
        panelMobileLayout={isPhonePanelLayout}
        t={t}
      />
    );

  const skipUserGridWithShareLayout = useShareWithParticipantsLayout;

  const renderSharePane = (keyOffset: number) => {
    if (presenterShareOnly) return null;
    if (shareFeeds.length === 0 && hasPendingRemoteShare) {
      return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-2 bg-black px-3 py-6">
          <Loader2 className="h-5 w-5 motion-reduce:animate-none animate-spin text-zinc-400" />
          <p className="text-center text-xs text-zinc-400">
            {t('callScreenShareActive')}
          </p>
        </div>
      );
    }
    return shareFeeds.map((feed, i) => (
      <div
        key={feedKey(feed, keyOffset + i)}
        className="flex min-h-0 min-w-0 flex-1 flex-col"
      >
        <CallFeedTile
          client={client}
          roomId={roomId}
          currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
          feed={feed}
          isShare
          isFullView={isFull}
          panelVideoFit={sharePanelVideoFit}
          panelFlush={panelFlush}
          isActiveSpeaker={
            activeSpeakerKey != null &&
            activeSpeakerKey === feedKeyForActive(feed)
          }
          room={room}
          currentUserId={currentUserId}
          resolveMemberLabel={resolveMemberLabel}
          isMicrophoneMuted={isMicrophoneMuted}
          isLocalVideoMuted={isLocalVideoMuted}
          isDocumentPipOpen={isDocumentPipOpen}
          t={t}
        />
      </div>
    ));
  };

  const renderMobileShareParticipantBand = () => {
    if (shareMobilePanelGrid && shareParticipantTiles.length > 1) {
      return (
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
            panelFlush ? 'p-0' : 'p-1',
          )}
        >
          <div className={shareMobilePanelGrid.gridClass}>
            {shareParticipantTiles.map((item, i) => (
              <div
                key={
                  item.kind === 'feed'
                    ? feedKey(item.feed, 1000 + i)
                    : `ph-share-mobile-${item.userId}-${i}`
                }
                className={shareMobilePanelGrid.cellClass}
              >
                {renderRemoteUserTile(item, 1000 + i)}
              </div>
            ))}
          </div>
        </div>
      );
    }

    return (
      <div
        className={cn(
          'flex min-h-0 min-w-0 flex-1 flex-row gap-1.5 overflow-x-auto',
          panelFlush ? 'px-0 py-1' : 'p-1.5',
        )}
        role="group"
        aria-label={t('callLayoutFilmstrip')}
      >
        {shareParticipantTiles.map((item, i) => (
          <div
            key={
              item.kind === 'feed'
                ? feedKey(item.feed, 1000 + i)
                : `ph-share-mobile-${item.userId}-${i}`
            }
            className={cn(
              'flex min-h-0 min-w-0 shrink-0 flex-col',
              shareParticipantTiles.length <= 1
                ? 'h-full w-full flex-1'
                : 'aspect-video h-full min-w-[42%] max-w-[50%]',
            )}
          >
            {renderRemoteUserTile(item, 1000 + i)}
          </div>
        ))}
      </div>
    );
  };

  const renderParticipantShareSidebar = (
    keyPrefix: number,
    tileClassName: string,
    presenterOnly = false,
  ) => {
    const bandClassName = presenterOnly
      ? 'h-full w-full flex-1'
      : isFull
      ? 'min-h-[4.5rem] w-full flex-1 lg:max-w-none'
      : 'ml-auto w-[min(50%,15rem)] min-w-[9.5rem] shrink-0 border-l border-[color:color-mix(in_srgb,var(--space-accent,var(--color-accent-9))_45%,transparent)]';

    return (
      <div
        className={cn(
          'flex min-h-0 flex-col gap-1.5 overflow-y-auto p-1.5',
          bandClassName,
        )}
        role="group"
        aria-label={t('callLayoutSideBySide')}
      >
        {shareParticipantTiles.map((item, i) => (
          <div
            key={
              item.kind === 'feed'
                ? feedKey(item.feed, keyPrefix + i)
                : `ph-presenter-${item.userId}-${i}`
            }
            className={tileClassName}
          >
            {renderRemoteUserTile(item, keyPrefix + i)}
          </div>
        ))}
      </div>
    );
  };

  /**
   * In-panel, 2+ user tiles: each cell is a flex column with the same min-height so
   * avatar-only and video rows match (video was capped by max-h and looked smaller).
   */
  const userGridCellClass = isFull
    ? 'flex h-full min-h-0 w-full min-w-0 flex-col'
    : mobilePanelGrid
    ? mobilePanelGrid.cellClass
    : panelFlush && userGridTileCount <= 1
    ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col'
    : userGridTileCount > 1 && !isFull
    ? 'relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col'
    : userGridTileCount > 1
    ? 'relative flex h-full min-h-0 w-full min-w-0 flex-1 flex-col'
    : 'min-w-0';

  return (
    <section
      className={cn(
        'relative w-full max-w-full @container/call',
        isFull
          ? 'box-border flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-0 bg-black p-0.5 text-zinc-50 ring-1 ring-inset ring-[color:color-mix(in_srgb,var(--space-accent,var(--color-accent-9))_45%,transparent)]'
          : panelFlush
          ? 'box-border flex h-full min-h-0 w-full min-w-0 max-h-full shrink-0 flex-col overflow-hidden bg-black p-0'
          : 'box-border flex h-full min-h-0 w-full min-w-0 max-h-full shrink-0 flex-col overflow-hidden border-b border-border bg-muted/20 p-0.5',
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
      {useShareWithParticipantsLayout ? (
        <div
          ref={onSplit ? splitRef : undefined}
          className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
          data-feed-tick={_feedVersion}
        >
          {presenterShareOnly ? (
            <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-black">
              {shareParticipantTiles.length === 0 ? (
                <div className="flex flex-1 items-center justify-center px-3 py-4">
                  <p className="text-center text-xs text-zinc-400">
                    {t('callScreenShareActive')}
                  </p>
                </div>
              ) : isFull && shareParticipantTiles.length >= 3 ? (
                <CallSpeakerPrimaryStrip
                  tiles={shareParticipantTiles}
                  activeSpeakerIndex={shareActiveSpeakerIndex}
                  speakerPrimaryRatio={0.7}
                  stripMaxVisible={5}
                  cellClassName="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
                  renderTile={renderRemoteUserTile}
                  overflowLabel={(count) => `+${count}`}
                />
              ) : isFull && shareParticipantTiles.length === 2 ? (
                <CallParticipantGalleryGrid
                  tiles={shareParticipantTiles}
                  isFull
                  galleryLayout={shareDuoGalleryLayout}
                  galleryPage={galleryPage}
                  onGalleryPageChange={setGalleryPage}
                  showPagination={false}
                  keyPrefix={1000}
                  cellClassName="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
                  renderTile={renderRemoteUserTile}
                  pageLabel={(current, total) =>
                    t('callGalleryPage', { current, total })
                  }
                  previousPageLabel={t('callGalleryPreviousPage')}
                  nextPageLabel={t('callGalleryNextPage')}
                />
              ) : shareParticipantTiles.length === 1 ? (
                <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
                  <div
                    className={cn(
                      'w-full shrink-0',
                      isFull
                        ? 'min-h-[4.5rem] flex-1'
                        : 'aspect-video min-h-[4rem] flex-1',
                    )}
                  >
                    {renderRemoteUserTile(shareParticipantTiles[0]!, 1000)}
                  </div>
                </div>
              ) : !isFull && shareMobilePanelGrid ? (
                <div
                  className={cn(
                    'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black',
                    panelFlush ? 'p-0' : 'p-1',
                  )}
                >
                  <div className={shareMobilePanelGrid.gridClass}>
                    {shareParticipantTiles.map((item, i) => (
                      <div
                        key={
                          item.kind === 'feed'
                            ? feedKey(item.feed, 1000 + i)
                            : `ph-share-mobile-${item.userId}-${i}`
                        }
                        className={shareMobilePanelGrid.cellClass}
                      >
                        {renderRemoteUserTile(item, 1000 + i)}
                      </div>
                    ))}
                  </div>
                </div>
              ) : !isFull ? (
                <CallPresenterParticipantFilmstrip
                  tiles={shareParticipantTiles}
                  renderTile={renderRemoteUserTile}
                  pageLabel={(current, total) =>
                    t('callGalleryPage', { current, total })
                  }
                  previousPageLabel={t('callGalleryPreviousPage')}
                  nextPageLabel={t('callGalleryNextPage')}
                  contentWidth={
                    isDocumentPipOpen
                      ? resolveScreenshareFilmstripContentWidth(
                          CALL_DOCUMENT_PIP_FILMSTRIP_WIDTH,
                        )
                      : undefined
                  }
                  stackAllTiles={isDocumentPipOpen}
                />
              ) : (
                renderParticipantShareSidebar(
                  1000,
                  cn('w-full shrink-0', 'min-h-[4.5rem]'),
                  true,
                )
              )}
            </div>
          ) : (
            <>
              {effectiveShareLayoutMode === 'sideBySide' &&
                (() => {
                  if (useMobileShareStackLayout) {
                    return (
                      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-black">
                        <div className="flex min-h-0 min-w-0 flex-[3] flex-col overflow-hidden border-b border-border/20">
                          {renderSharePane(0)}
                        </div>
                        <div className="flex min-h-0 min-w-0 flex-[2] flex-col overflow-hidden">
                          {renderMobileShareParticipantBand()}
                        </div>
                      </div>
                    );
                  }
                  const r = fullViewPaneSplit.sideBySide;
                  const a = Math.max(0, Math.min(1, r));
                  return (
                    <div
                      className={cn(
                        'flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden',
                        isFull ? 'lg:flex-row' : 'flex-row',
                      )}
                    >
                      <div
                        className={cn(
                          'flex min-w-0 min-h-[4.5rem] flex-1 flex-col',
                          isFull
                            ? 'w-full border-b border-border/20 pb-0 lg:min-h-0 lg:w-auto lg:border-b-0 lg:border-r lg:pb-0'
                            : 'min-h-0 border-r border-border/20',
                        )}
                        style={
                          isFull
                            ? { flex: `1 1 ${a * 100}%` }
                            : { flex: '1 1 0%' }
                        }
                      >
                        {renderSharePane(0)}
                      </div>
                      {onSplit && isFull && (
                        <CallFullViewPaneSplitter
                          orientation="horizontal"
                          containerRef={splitRef}
                          ratio={r}
                          onRatioChange={(v) => onSplit('sideBySide', v)}
                          className="lg:hidden"
                          aria-label={t('callPaneResizeSharePeople')}
                        />
                      )}
                      {onSplit && isFull && (
                        <CallFullViewPaneSplitter
                          orientation="vertical"
                          containerRef={splitRef}
                          ratio={r}
                          onRatioChange={(v) => onSplit('sideBySide', v)}
                          className="hidden lg:block"
                          aria-label={t('callPaneResizeSharePeople')}
                        />
                      )}
                      <div
                        className={cn(
                          'flex min-h-0 flex-col gap-1.5 overflow-y-auto p-1.5',
                          isFull
                            ? 'w-full min-h-[4.5rem] max-h-[min(50dvh,20rem)] flex-1 lg:max-w-none'
                            : 'w-[min(50%,15rem)] min-w-[9.5rem] shrink-0',
                        )}
                        style={
                          isFull ? { flex: `1 1 ${(1 - a) * 100}%` } : undefined
                        }
                        role="group"
                        aria-label={t('callLayoutSideBySide')}
                      >
                        {shareParticipantTiles.map((item, i) => (
                          <div
                            key={
                              item.kind === 'feed'
                                ? feedKey(item.feed, 1000 + i)
                                : `ph-side-${item.userId}-${i}`
                            }
                            className={cn(
                              'w-full shrink-0',
                              isFull
                                ? 'min-h-[6rem]'
                                : 'aspect-video min-h-[5.5rem]',
                            )}
                          >
                            {renderRemoteUserTile(item, 1000 + i)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              {isFull &&
                fullViewLayoutMode === 'filmstrip' &&
                (() => {
                  const r = fullViewPaneSplit.filmstrip;
                  const a = Math.max(0, Math.min(1, r));
                  return (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      <div
                        className="flex min-h-0 min-w-0 flex-1 flex-col"
                        style={{ flex: `${a} 1 0%` }}
                      >
                        {renderSharePane(100)}
                      </div>
                      {onSplit && (
                        <CallFullViewPaneSplitter
                          orientation="horizontal"
                          containerRef={splitRef}
                          ratio={r}
                          onRatioChange={(v) => onSplit('filmstrip', v)}
                          aria-label={t('callPaneResizeShareStrip')}
                        />
                      )}
                      <div
                        className={cn(
                          'w-full min-h-0 shrink-0 border-t border-border/30 p-2',
                          useShareParticipantGridBand
                            ? 'flex min-h-[8rem] flex-1 flex-col'
                            : 'flex min-h-[3.5rem] items-stretch gap-2 overflow-x-auto',
                        )}
                        style={{ flex: `${1 - a} 1 0%` }}
                        role="group"
                        aria-label={t('callLayoutFilmstrip')}
                      >
                        {useShareParticipantGridBand ? (
                          <CallParticipantGalleryGrid
                            tiles={shareParticipantTiles}
                            isFull={isFull}
                            galleryLayout={
                              useShareParticipantDuo
                                ? shareDuoGalleryLayout
                                : undefined
                            }
                            galleryPage={galleryPage}
                            onGalleryPageChange={setGalleryPage}
                            showPagination={useShareParticipantGallery}
                            keyPrefix={2000}
                            cellClassName="min-h-0 w-full min-w-0"
                            renderTile={renderRemoteUserTile}
                            pageLabel={(current, total) =>
                              t('callGalleryPage', { current, total })
                            }
                            previousPageLabel={t('callGalleryPreviousPage')}
                            nextPageLabel={t('callGalleryNextPage')}
                          />
                        ) : useShareParticipantSpeakerStrip ? (
                          <CallSpeakerPrimaryStrip
                            tiles={shareParticipantTiles}
                            activeSpeakerIndex={shareActiveSpeakerIndex}
                            speakerPrimaryRatio={0.7}
                            stripMaxVisible={Math.min(
                              5,
                              shareParticipantTiles.length - 1,
                            )}
                            cellClassName="min-h-0 w-full min-w-0"
                            renderTile={renderRemoteUserTile}
                            overflowLabel={(count) => `+${count}`}
                          />
                        ) : (
                          shareParticipantTiles.map((item, i) => (
                            <div
                              key={
                                item.kind === 'feed'
                                  ? feedKey(item.feed, 2000 + i)
                                  : `ph-strip-${item.userId}-${i}`
                              }
                              className="h-full min-h-[4.5rem] w-[min(42%,9rem)] min-w-[6.5rem] shrink-0"
                            >
                              {renderRemoteUserTile(item, 2000 + i)}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  );
                })()}
              {isFull &&
                fullViewLayoutMode === 'speakerTop' &&
                (() => {
                  const r = fullViewPaneSplit.speakerOnTop;
                  const a = Math.max(0, Math.min(1, r));
                  const hasSpeakerTopPane =
                    useShareParticipantGridBand ||
                    useShareParticipantSpeakerStrip ||
                    Boolean(speakerFeedForTopMode || speakerTopPlaceholderId);
                  return (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      {hasSpeakerTopPane && (
                        <div
                          className={cn(
                            'w-full min-h-0 shrink-0 border-b border-border/30 p-2',
                            useShareParticipantGridBand
                              ? 'flex min-h-[8rem] max-h-[min(45dvh,20rem)] flex-col'
                              : 'min-h-[3.5rem] max-h-[min(40dvh,16rem)]',
                          )}
                          style={{ flex: `${a} 1 0%` }}
                          role="group"
                          aria-label={t('callLayoutSpeakerOnTop')}
                        >
                          {useShareParticipantGridBand ? (
                            <CallParticipantGalleryGrid
                              tiles={shareParticipantTiles}
                              isFull={isFull}
                              galleryLayout={
                                useShareParticipantDuo
                                  ? shareDuoGalleryLayout
                                  : undefined
                              }
                              galleryPage={galleryPage}
                              onGalleryPageChange={setGalleryPage}
                              showPagination={useShareParticipantGallery}
                              keyPrefix={2100}
                              cellClassName="min-h-0 w-full min-w-0"
                              className="h-full w-full flex-1"
                              renderTile={renderRemoteUserTile}
                              pageLabel={(current, total) =>
                                t('callGalleryPage', { current, total })
                              }
                              previousPageLabel={t('callGalleryPreviousPage')}
                              nextPageLabel={t('callGalleryNextPage')}
                            />
                          ) : useShareParticipantSpeakerStrip ? (
                            <CallSpeakerPrimaryStrip
                              tiles={shareParticipantTiles}
                              activeSpeakerIndex={shareActiveSpeakerIndex}
                              speakerPrimaryRatio={0.7}
                              stripMaxVisible={Math.min(
                                5,
                                shareParticipantTiles.length - 1,
                              )}
                              cellClassName="min-h-0 w-full min-w-0"
                              className="h-full w-full flex-1"
                              renderTile={renderRemoteUserTile}
                              overflowLabel={(count) => `+${count}`}
                            />
                          ) : (
                            <div
                              className="h-full min-h-0"
                              key="speaker-top-tile"
                            >
                              {speakerFeedForTopMode ? (
                                <CallFeedTile
                                  client={client}
                                  roomId={roomId}
                                  currentUserProfileAvatarUrl={
                                    currentUserProfileAvatarUrl
                                  }
                                  feed={speakerFeedForTopMode}
                                  isFullView={isFull}
                                  panelVideoFit={effectivePanelVideoFit}
                                  panelFlush={panelFlush}
                                  isActiveSpeaker
                                  room={room}
                                  currentUserId={currentUserId}
                                  resolveMemberLabel={resolveMemberLabel}
                                  isMicrophoneMuted={isMicrophoneMuted}
                                  isLocalVideoMuted={isLocalVideoMuted}
                                  isDocumentPipOpen={isDocumentPipOpen}
                                  {...reactionPropsForFeed(
                                    speakerFeedForTopMode,
                                  )}
                                  t={t}
                                />
                              ) : speakerTopPlaceholderId ? (
                                <CallParticipantPlaceholderTile
                                  client={client}
                                  roomId={roomId}
                                  userId={speakerTopPlaceholderId}
                                  currentUserId={currentUserId}
                                  currentUserProfileAvatarUrl={
                                    currentUserProfileAvatarUrl
                                  }
                                  isFullView={isFull}
                                  isPip={false}
                                  resolveMemberLabel={resolveMemberLabel}
                                  remoteMediaStall={remoteMediaStall}
                                  handRaised={
                                    isHandRaised?.(speakerTopPlaceholderId) ??
                                    false
                                  }
                                  raiseHandOrder={
                                    getRaiseHandOrder?.(
                                      speakerTopPlaceholderId,
                                    ) ?? null
                                  }
                                  panelMobileLayout={isPhonePanelLayout}
                                  t={t}
                                />
                              ) : null}
                            </div>
                          )}
                        </div>
                      )}
                      {onSplit && hasSpeakerTopPane && (
                        <CallFullViewPaneSplitter
                          orientation="horizontal"
                          containerRef={splitRef}
                          ratio={r}
                          onRatioChange={(v) => onSplit('speakerOnTop', v)}
                          aria-label={t('callPaneResizeSpeakerShare')}
                        />
                      )}
                      <div
                        className="flex min-h-0 min-w-0 flex-1 flex-col"
                        style={{
                          flex: hasSpeakerTopPane ? `${1 - a} 1 0%` : '1 1 0%',
                        }}
                      >
                        {renderSharePane(200)}
                      </div>
                    </div>
                  );
                })()}
            </>
          )}
        </div>
      ) : (
        hasRenderableShare &&
        !presenterShareOnly && (
          <div
            className={cn(
              'w-full',
              isFull && 'flex min-h-0 min-w-0 flex-1 flex-col p-0',
              isFull && hasRenderableShare && 'min-w-0', // FV-1: full width of main stage
              !isFull && panelFlush && 'p-0',
              !isFull && !panelFlush && 'p-2 pb-0',
            )}
            data-feed-tick={_feedVersion}
          >
            {shareFeeds.length === 0 && hasPendingRemoteShare ? (
              <div className="flex min-h-[4.5rem] flex-1 flex-col items-center justify-center gap-2 bg-black px-3 py-6">
                <Loader2 className="h-5 w-5 motion-reduce:animate-none animate-spin text-zinc-400" />
                <p className="text-center text-xs text-zinc-400">
                  {t('callScreenShareActive')}
                </p>
              </div>
            ) : (
              shareFeeds.map((feed, i) => (
                <div
                  key={feedKey(feed, i)}
                  className={cn(
                    'w-full max-w-full',
                    isFull && 'flex min-h-0 min-w-0 flex-1 flex-col',
                  )}
                >
                  <CallFeedTile
                    client={client}
                    roomId={roomId}
                    currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
                    feed={feed}
                    isShare
                    isFullView={isFull}
                    panelVideoFit={effectivePanelVideoFit}
                    panelFlush={panelFlush}
                    isActiveSpeaker={
                      activeSpeakerKey != null &&
                      activeSpeakerKey === feedKeyForActive(feed)
                    }
                    room={room}
                    currentUserId={currentUserId}
                    resolveMemberLabel={resolveMemberLabel}
                    isMicrophoneMuted={isMicrophoneMuted}
                    isLocalVideoMuted={isLocalVideoMuted}
                    isDocumentPipOpen={isDocumentPipOpen}
                    t={t}
                  />
                </div>
              ))
            )}
          </div>
        )
      )}
      {(hasRemotesOrShare || showLocalInMainGrid) &&
        !skipUserGridWithShareLayout &&
        (useSpeakerStripLayout ? (
          <div
            className={cn(
              'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
              panelFlush && !isFull ? 'p-0' : 'px-2 pb-2 pt-0',
            )}
            data-feed-tick={_feedVersion}
          >
            <CallSpeakerPrimaryStrip
              tiles={layoutParticipantTiles}
              activeSpeakerIndex={activeSpeakerIndex}
              speakerPrimaryRatio={layoutPlan.speakerPrimaryRatio}
              stripMaxVisible={layoutPlan.stripMaxVisible}
              cellClassName={userGridCellClass}
              panelDock={!isFull}
              isPortrait={isDocumentPipOpen}
              stripDirection="row"
              renderTile={renderRemoteUserTile}
              overflowLabel={(count) => `+${count}`}
              stripPage={galleryPage}
              onStripPageChange={setGalleryPage}
              showStripPagination={layoutPlan.showGalleryPagination}
              pageLabel={(current, total) =>
                t('callGalleryPage', { current, total })
              }
              previousPageLabel={t('callGalleryPreviousPage')}
              nextPageLabel={t('callGalleryNextPage')}
            />
          </div>
        ) : useMobilePaginatedParticipantGallery ? (
          <div
            className={cn(
              'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden',
              panelFlush && !isFull ? 'p-0' : 'px-2 pb-2 pt-0',
            )}
            data-feed-tick={_feedVersion}
          >
            <CallParticipantGalleryGrid
              tiles={layoutParticipantTiles}
              isFull={false}
              maxCols={2}
              galleryPage={galleryPage}
              onGalleryPageChange={setGalleryPage}
              showPagination
              keyPrefix={0}
              cellClassName={userGridCellClass}
              renderTile={renderRemoteUserTile}
              pageLabel={(current, total) =>
                t('callGalleryPage', { current, total })
              }
              previousPageLabel={t('callGalleryPreviousPage')}
              nextPageLabel={t('callGalleryNextPage')}
            />
          </div>
        ) : useMainGalleryLayout ? (
          <div
            className={cn(
              'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
              panelFlush && !isFull ? 'p-0' : 'px-2 pb-2 pt-0',
            )}
            data-feed-tick={_feedVersion}
          >
            <CallParticipantGalleryGrid
              tiles={layoutParticipantTiles}
              isFull={isFull}
              galleryLayout={layoutPlan.galleryLayout ?? undefined}
              tilePlacements={layoutPlan.tilePlacements}
              galleryPage={galleryPage}
              onGalleryPageChange={setGalleryPage}
              showPagination={
                layoutPlan.showGalleryPagination ||
                (isFull &&
                  layoutParticipantTiles.length >
                    CALL_GALLERY_MAX_TILES_PER_PAGE)
              }
              keyPrefix={0}
              cellClassName={userGridCellClass}
              renderTile={renderRemoteUserTile}
              pageLabel={(current, total) =>
                t('callGalleryPage', { current, total })
              }
              previousPageLabel={t('callGalleryPreviousPage')}
              nextPageLabel={t('callGalleryNextPage')}
            />
          </div>
        ) : useFullViewSingleMainTile ? (
          <div
            className={cn(
              'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
              centerSoloTileInStage && 'items-center justify-center',
              panelFlush ? 'p-0' : 'px-2 pb-2 pt-0',
            )}
            data-feed-tick={_feedVersion}
          >
            {remoteUserMedia[0] ? (
              <div
                className={cn(
                  'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
                  centerSoloTileInStage && 'max-h-full',
                )}
              >
                <CallFeedTile
                  client={client}
                  roomId={roomId}
                  currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
                  feed={remoteUserMedia[0]}
                  isFullView={isFull}
                  panelVideoFit={effectivePanelVideoFit}
                  panelFlush={panelFlush}
                  isActiveSpeaker={
                    activeSpeakerKey != null &&
                    activeSpeakerKey === feedKeyForActive(remoteUserMedia[0]!)
                  }
                  room={room}
                  currentUserId={currentUserId}
                  resolveMemberLabel={resolveMemberLabel}
                  isMicrophoneMuted={isMicrophoneMuted}
                  isLocalVideoMuted={isLocalVideoMuted}
                  isDocumentPipOpen={isDocumentPipOpen}
                  centerContent={centerSoloTileInStage}
                  {...reactionPropsForFeed(remoteUserMedia[0]!)}
                  t={t}
                />
              </div>
            ) : missingRemoteUserIds[0] ? (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
                <CallParticipantPlaceholderTile
                  client={client}
                  roomId={roomId}
                  userId={missingRemoteUserIds[0]}
                  currentUserId={currentUserId}
                  currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
                  isFullView={isFull}
                  isPip={false}
                  resolveMemberLabel={resolveMemberLabel}
                  remoteMediaStall={remoteMediaStall}
                  handRaised={isHandRaised?.(missingRemoteUserIds[0]) ?? false}
                  raiseHandOrder={
                    getRaiseHandOrder?.(missingRemoteUserIds[0]) ?? null
                  }
                  panelMobileLayout={isPhonePanelLayout}
                  t={t}
                />
              </div>
            ) : showLocalInMainGrid && localUserMedia[0] ? (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
                <CallFeedTile
                  client={client}
                  roomId={roomId}
                  currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
                  feed={localUserMedia[0]}
                  isFullView={isFull}
                  panelVideoFit={effectivePanelVideoFit}
                  panelFlush={panelFlush}
                  isActiveSpeaker={
                    activeSpeakerKey != null &&
                    activeSpeakerKey === feedKeyForActive(localUserMedia[0]!)
                  }
                  room={room}
                  currentUserId={currentUserId}
                  resolveMemberLabel={resolveMemberLabel}
                  isMicrophoneMuted={isMicrophoneMuted}
                  isLocalVideoMuted={isLocalVideoMuted}
                  isDocumentPipOpen={isDocumentPipOpen}
                  centerContent={centerSoloTileInStage}
                  {...reactionPropsForFeed(localUserMedia[0]!)}
                  t={t}
                />
              </div>
            ) : null}
          </div>
        ) : (
          <div
            className={cn(
              panelFlush && !isFull
                ? 'grid h-full min-h-0 w-full min-w-0 flex-1 gap-0 p-0'
                : 'grid gap-2 p-2 pt-2',
              isFull
                ? cn(
                    'h-full min-h-0 w-full min-w-0 flex-1',
                    'content-stretch items-stretch [grid-auto-rows:minmax(0,1fr)]',
                    fullViewUserColumnClass,
                    'overflow-y-auto px-2 pb-2 pt-0',
                    // FV-5: when screen share is primary, user tiles are a bounded strip
                    hasRenderableShare
                      ? 'max-h-[min(40dvh,320px)] shrink-0'
                      : null,
                  )
                : mobilePanelGrid
                ? mobilePanelGrid.gridClass
                : cn(
                    hasRenderableShare ? 'max-h-[min(50vh,420px)]' : null,
                    !isFull && userGridTileCount > 1
                      ? 'auto-rows-[minmax(min(40vh,280px),1fr)]'
                      : null,
                    panelUserGridColumnClass,
                  ),
              !isFull &&
                !mobilePanelGrid &&
                !hasRenderableShare &&
                remoteUserMedia.length > 0 &&
                'min-h-[min(32vh,220px)]',
              !isFull &&
                !mobilePanelGrid &&
                showLocalInMainGrid &&
                'min-h-[min(32vh,240px)]',
            )}
            data-feed-tick={_feedVersion}
          >
            {(useMobileBalancedParticipantGrid
              ? layoutParticipantTiles
              : [
                  ...remoteUserTiles,
                  ...(showLocalInMainGrid
                    ? localUserMedia.map(
                        (feed): RemoteTileItem => ({ kind: 'feed', feed }),
                      )
                    : []),
                ]
            ).map((item, i) => (
              <div
                key={
                  item.kind === 'feed'
                    ? feedKey(item.feed, i)
                    : `ph-grid-${item.userId}-${i}`
                }
                className={userGridCellClass}
              >
                {renderRemoteUserTile(item, i)}
              </div>
            ))}
          </div>
        ))}
      {isVideoCall &&
        localUserMedia.length > 0 &&
        hasLocalWebcam &&
        showFloatingLocalPip && (
          <div
            className={cn(
              'pointer-events-none absolute z-10 flex overflow-hidden rounded-md border-2 border-border bg-black shadow-lg',
              isFull
                ? 'end-4 bottom-4 w-[min(22%,11rem)] min-w-[5.5rem] aspect-video'
                : 'bottom-2 end-2 w-[32%] min-w-[5.5rem] max-w-[8.5rem] aspect-video',
            )}
          >
            {localUserMedia.map((feed, i) => (
              <CallFeedTile
                client={client}
                roomId={roomId}
                currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
                key={feedKey(feed, i)}
                feed={feed}
                isPip
                isFullView={isFull}
                panelVideoFit={effectivePanelVideoFit}
                panelFlush={panelFlush}
                isActiveSpeaker={
                  activeSpeakerKey != null &&
                  activeSpeakerKey === feedKeyForActive(feed)
                }
                room={room}
                currentUserId={currentUserId}
                resolveMemberLabel={resolveMemberLabel}
                isMicrophoneMuted={isMicrophoneMuted}
                isLocalVideoMuted={isLocalVideoMuted}
                isDocumentPipOpen={isDocumentPipOpen}
                {...reactionPropsForFeed(feed)}
                t={t}
              />
            ))}
          </div>
        )}
    </section>
  );
}

function usePlaceholderParticipantName(
  room: MatrixRoom | null,
  userId: string,
  resolveMemberLabel: (userId: string | undefined) => string,
  fallback: string,
): { text: string; showSkeleton: boolean; hyphaAvatarUrl?: string } {
  const syncLabel = useMemo(() => {
    const roster = resolveMemberLabel(userId)?.trim();
    if (roster && !looksLikeTechnicalMatrixDisplayName(roster, userId)) {
      return roster;
    }
    const m = room?.getMember(userId) ?? null;
    if (m) return matrixMemberDisplayLabel(m, userId);
    return fallback;
  }, [room, userId, resolveMemberLabel, fallback]);

  const needsProfile = needsHyphaResolutionForCallLabel(syncLabel, userId);
  const canonicalSub = matrixUserIdToCanonicalPrivySub(userId);
  const needsMatrixLinkLookup = needsProfile && !canonicalSub;
  const { privyUserId: linkedSub } = useUserPrivyIdByMatrixId({
    matrixUserId: needsMatrixLinkLookup ? userId : undefined,
  });
  const resolvedSub = canonicalSub ?? linkedSub;
  const { person } = usePersonBySub({
    sub: resolvedSub,
  });

  const text = useMemo(() => {
    const fromPerson = person ? formatHyphaPersonName(person) : '';
    const matrixMemberLabel = (() => {
      const m = room?.getMember(userId) ?? null;
      if (m) return matrixMemberDisplayLabel(m, userId);
      return '';
    })();
    return resolveCallParticipantDisplayText({
      isPip: false,
      isLocalFeed: false,
      currentUserId: null,
      syncLabel,
      personName: fromPerson,
      matrixUserId: userId,
      matrixMemberLabel,
      fallback,
    });
  }, [room, userId, person, syncLabel, fallback]);

  const showSkeleton = false;
  const hyphaAvatarUrl = person?.avatarUrl?.trim() || undefined;

  return { text, showSkeleton, hyphaAvatarUrl };
}

function CallParticipantPlaceholderTile({
  client,
  roomId,
  userId,
  currentUserId,
  currentUserProfileAvatarUrl,
  isFullView,
  isPip,
  resolveMemberLabel,
  remoteMediaStall = false,
  handRaised = false,
  raiseHandOrder = null,
  panelMobileLayout = false,
  t,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  userId: string;
  currentUserId: string | null;
  currentUserProfileAvatarUrl?: string | null;
  isFullView: boolean;
  isPip: boolean;
  resolveMemberLabel: (userId: string | undefined) => string;
  remoteMediaStall?: boolean;
  handRaised?: boolean;
  raiseHandOrder?: number | null;
  panelMobileLayout?: boolean;
  t: (key: string, values?: Record<string, string | number>) => string;
}) {
  const room: MatrixRoom | null =
    roomId && client ? client.getRoom(roomId) ?? null : null;
  const {
    text: label,
    showSkeleton,
    hyphaAvatarUrl,
  } = usePlaceholderParticipantName(
    room,
    userId,
    resolveMemberLabel,
    t('callRemoteParticipant'),
  );
  const px = isPip ? 48 : isFullView && !isPip ? 128 : 80;
  const avatarUrl =
    matrixMemberAvatarSquareForCall(client, roomId, userId, px) ??
    hyphaAvatarUrl ??
    (userId === currentUserId
      ? currentUserProfileAvatarUrl?.trim() || undefined
      : undefined);

  const statusLine = remoteMediaStall
    ? t('callRemoteParticipantMediaStalled')
    : t('callConnecting');
  const useMobilePlaceholderChrome = panelMobileLayout && !isFullView && !isPip;

  return (
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-md bg-black text-zinc-50',
        useMobilePlaceholderChrome
          ? 'items-stretch justify-end p-0'
          : cn(
              'items-center justify-center gap-3 p-4 text-center',
              isPip && 'gap-1.5 p-2',
            ),
      )}
      role="status"
      aria-busy={!remoteMediaStall}
      aria-label={`${label} — ${statusLine}`}
    >
      <CallRaiseHandBadge
        handRaised={handRaised}
        order={raiseHandOrder}
        positionClass="absolute end-2 top-2 z-[2]"
        ariaLabel={
          raiseHandOrder != null
            ? t('callRaiseHandBadgeOrder', { order: raiseHandOrder })
            : t('callRaiseHandBadge')
        }
        title={
          raiseHandOrder != null
            ? t('callRaiseHandBadgeOrder', { order: raiseHandOrder })
            : t('callRaiseHandBadge')
        }
      />
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-zinc-200 ring-1 ring-white/20',
          useMobilePlaceholderChrome &&
            'absolute start-1/2 top-[38%] h-8 w-8 -translate-x-1/2',
          isPip
            ? 'h-8 w-8'
            : isFullView && !isPip
            ? 'h-20 w-20 sm:h-24 sm:w-24'
            : useMobilePlaceholderChrome
            ? undefined
            : 'h-14 w-14',
        )}
      >
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt=""
            className="h-full w-full object-cover"
            loading="eager"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <User
            className={cn(
              isPip
                ? 'h-4 w-4'
                : isFullView && !isPip
                ? 'h-10 w-10 sm:h-12 sm:w-12'
                : 'h-7 w-7',
            )}
            aria-hidden
          />
        )}
        {!remoteMediaStall ? (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/35">
            <Loader2
              className={cn(
                'animate-spin text-zinc-100',
                isPip ? 'h-3.5 w-3.5' : 'h-6 w-6',
              )}
              strokeWidth={2.25}
              aria-hidden
            />
          </div>
        ) : null}
      </div>
      {useMobilePlaceholderChrome ? (
        <div
          className={cn(
            'absolute start-1 bottom-1 z-10 max-w-[calc(100%-0.5rem)] truncate rounded px-1 py-px text-[9px] leading-3',
            CALL_FEED_VIDEO_LABEL_CHIP_TONE_CLASS,
            CALL_FEED_VIDEO_LABEL_NAME_CLASS,
          )}
        >
          {showSkeleton ? <Skeleton loading width={56} height={10} /> : label}
        </div>
      ) : (
        <p
          className={cn(
            'line-clamp-2 max-w-full font-medium',
            isFullView && !isPip ? 'text-base sm:text-lg' : 'text-sm',
            isPip && 'text-[10px] leading-tight',
          )}
        >
          {showSkeleton ? (
            <Skeleton loading width={100} height={14} className="mx-auto" />
          ) : (
            label
          )}
        </p>
      )}
      <p
        className={cn(
          useMobilePlaceholderChrome && 'sr-only',
          'max-w-[min(100%,18rem)]',
          remoteMediaStall
            ? cn('font-medium', callAccentAlertOnDarkText)
            : 'text-muted-foreground/90',
          isPip ? 'text-[9px]' : 'text-xs',
        )}
      >
        {statusLine}
      </p>
    </div>
  );
}

function formatHyphaPersonName(p: {
  name?: string | null;
  surname?: string | null;
  nickname?: string | null;
}): string {
  const full = [p.name, p.surname].filter(Boolean).join(' ').trim();
  if (full) return full;
  if (p.nickname?.trim()) return p.nickname.trim();
  return '';
}

/** Same rule as timeline headers: fetch Hypha Person when Matrix/roster label is still bridged-tech. */
function needsHyphaResolutionForCallLabel(
  profileLabel: string | undefined,
  matrixUserId: string | undefined,
): boolean {
  if (!matrixUserId?.trim()) return false;
  const l = profileLabel?.trim() ?? '';
  if (!l) return true;
  if (l === matrixUserId) return true;
  return needsHyphaProfileResolutionForMatrixLabel(l);
}

function useCallParticipantDisplayName(
  room: MatrixRoom | null,
  feed: CallFeed,
  currentUserId: string | null,
  resolveMemberLabel: (userId: string | undefined) => string,
  fallback: string,
  isPip: boolean,
  isShare: boolean,
  isAudioOnlyTile: boolean,
): { text: string; showSkeleton: boolean; hyphaAvatarUrl?: string } {
  const uid = feed.userId;
  const isLocalFeed = feed.isLocal();
  const [profileTimedOut, setProfileTimedOut] = useState(false);

  const syncLabel = useMemo(() => {
    if (isPip) return ''; // caller uses "You"
    if (isLocalFeed && currentUserId) {
      return resolveMemberLabel(currentUserId).trim();
    }
    /** Roster/Hypha merge first — avoid Privy slug from raw Matrix member displayname. */
    const roster = resolveMemberLabel(uid)?.trim();
    if (roster && !looksLikeTechnicalMatrixDisplayName(roster, uid)) {
      return roster;
    }
    const m = room?.getMember(uid) ?? null;
    if (m) return matrixMemberDisplayLabel(m, uid);
    return fallback;
  }, [
    room,
    uid,
    isLocalFeed,
    currentUserId,
    resolveMemberLabel,
    fallback,
    isPip,
    isShare,
  ]);

  const needsProfile =
    !isPip && !isLocalFeed && needsHyphaResolutionForCallLabel(syncLabel, uid);

  const canonicalSub = uid ? matrixUserIdToCanonicalPrivySub(uid) : null;
  const needsMatrixLinkLookup = needsProfile && !canonicalSub;
  const { privyUserId: linkedSub, isLoading: loadingLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: needsMatrixLinkLookup ? uid : undefined,
    });
  const resolvedSub = canonicalSub ?? linkedSub;
  const { person, isLoading: loadingPerson } = usePersonBySub({
    sub: resolvedSub,
  });

  useEffect(() => {
    setProfileTimedOut(false);
    if (!needsProfile) return;
    const timer = window.setTimeout(() => {
      setProfileTimedOut(true);
    }, CALL_PARTICIPANT_PROFILE_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [needsProfile, uid]);

  const matrixMemberLabel = useMemo(() => {
    const m = room?.getMember(uid) ?? null;
    if (m) return matrixMemberDisplayLabel(m, uid);
    return '';
  }, [room, uid]);

  const text = useMemo(
    () =>
      resolveCallParticipantDisplayText({
        isPip,
        isLocalFeed,
        currentUserId,
        syncLabel,
        personName: person ? formatHyphaPersonName(person) : '',
        matrixUserId: uid,
        matrixMemberLabel,
        fallback,
      }),
    [
      isPip,
      isLocalFeed,
      currentUserId,
      syncLabel,
      person,
      uid,
      matrixMemberLabel,
      fallback,
    ],
  );

  const showSkeleton = shouldShowCallParticipantNameSkeleton({
    isPip,
    isShare,
    isAudioOnlyTile,
    needsProfile,
    loadingLink,
    loadingPerson,
    linkedSub,
    profileTimedOut,
  });

  const hyphaAvatarUrl = person?.avatarUrl?.trim() || undefined;

  return { text, showSkeleton, hyphaAvatarUrl };
}

const CallFeedTile = ({
  client,
  roomId,
  currentUserProfileAvatarUrl,
  feed,
  isShare = false,
  isPip = false,
  isActiveSpeaker = false,
  isFullView = false,
  panelVideoFit = 'cover',
  panelFlush = false,
  room,
  currentUserId,
  resolveMemberLabel,
  isMicrophoneMuted,
  isLocalVideoMuted,
  isDocumentPipOpen = false,
  centerContent: _centerContent = false,
  floatingReactions = [],
  handRaised = false,
  raiseHandOrder = null,
  panelMobileLayout = false,
  t,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  currentUserProfileAvatarUrl?: string | null;
  feed: CallFeed;
  panelMobileLayout?: boolean;
  isShare?: boolean;
  isPip?: boolean;
  isActiveSpeaker?: boolean;
  isFullView?: boolean;
  panelVideoFit?: 'cover' | 'contain';
  panelFlush?: boolean;
  room: MatrixRoom | null;
  currentUserId: string | null;
  resolveMemberLabel: (userId: string | undefined) => string;
  isMicrophoneMuted?: boolean;
  isLocalVideoMuted?: boolean;
  isDocumentPipOpen?: boolean;
  centerContent?: boolean;
  floatingReactions?: CallFloatingReaction[];
  handRaised?: boolean;
  raiseHandOrder?: number | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) => {
  const nameFallback = isShare
    ? t('callScreenShare')
    : t('callRemoteParticipant');
  return (
    <FeedContent
      client={client}
      roomId={roomId}
      room={room}
      currentUserId={currentUserId}
      currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
      feed={feed}
      isShare={isShare}
      isPip={isPip}
      isFullView={isFullView}
      isActiveSpeaker={isActiveSpeaker}
      resolveMemberLabel={resolveMemberLabel}
      nameFallback={nameFallback}
      panelVideoFit={panelVideoFit}
      panelFlush={panelFlush}
      isMicrophoneMuted={isMicrophoneMuted}
      isLocalVideoMuted={isLocalVideoMuted}
      isDocumentPipOpen={isDocumentPipOpen}
      centerContent={_centerContent}
      floatingReactions={floatingReactions}
      handRaised={handRaised}
      raiseHandOrder={raiseHandOrder}
      panelMobileLayout={panelMobileLayout}
      t={t}
    />
  );
};

const FeedContent = ({
  client,
  roomId,
  room,
  currentUserId,
  currentUserProfileAvatarUrl,
  feed,
  isShare,
  isPip,
  isFullView,
  panelVideoFit,
  panelFlush,
  isActiveSpeaker,
  resolveMemberLabel,
  nameFallback,
  isMicrophoneMuted,
  isLocalVideoMuted,
  isDocumentPipOpen = false,
  centerContent: _centerContent = false,
  floatingReactions = [],
  handRaised = false,
  raiseHandOrder = null,
  panelMobileLayout = false,
  t,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  room: MatrixRoom | null;
  currentUserId: string | null;
  currentUserProfileAvatarUrl?: string | null;
  feed: CallFeed;
  panelMobileLayout?: boolean;
  isShare: boolean;
  isPip: boolean;
  isFullView: boolean;
  panelVideoFit: 'cover' | 'contain';
  panelFlush: boolean;
  isActiveSpeaker: boolean;
  resolveMemberLabel: (userId: string | undefined) => string;
  nameFallback: string;
  isMicrophoneMuted?: boolean;
  isLocalVideoMuted?: boolean;
  isDocumentPipOpen?: boolean;
  centerContent?: boolean;
  floatingReactions?: CallFloatingReaction[];
  handRaised?: boolean;
  raiseHandOrder?: number | null;
  t: (key: string, values?: Record<string, string | number>) => string;
}) => {
  const compactTileLayout = isPip || isDocumentPipOpen;
  const audioScrimLayout = resolveCallFeedAudioScrimLayout({
    isPip,
    isFullView,
    isDocumentPipOpen,
    panelMobileLayout,
  });
  const videoLabelLayout = resolveCallFeedVideoParticipantLabelLayout({
    isFullView,
    compactTileLayout,
    panelMobileLayout,
  });
  const audioMuted = feedReportsAudioMutedForTile(
    feed,
    isMicrophoneMuted,
    isShare,
    currentUserId,
  );
  const feedVideoOptions = {
    isShare,
    isLocalVideoMuted,
    currentUserId,
  };
  const liveVideoTrack = resolveCallFeedLiveVideoTrack(feed, feedVideoOptions);
  const hasVideo = liveVideoTrack !== null;
  const isAudioOnlyTile = !isShare && !hasVideo;
  const {
    text: resolvedName,
    showSkeleton,
    hyphaAvatarUrl,
  } = useCallParticipantDisplayName(
    room,
    feed,
    currentUserId,
    resolveMemberLabel,
    nameFallback,
    isPip,
    isShare,
    isAudioOnlyTile,
  );
  const shareOverlayLabel =
    isShare && !isPip
      ? formatCallShareTileLabel(resolvedName, nameFallback)
      : resolvedName;
  const overlayLabel = isPip ? t('callYou') : shareOverlayLabel;
  const ariaLabel =
    isShare && !isPip ? shareOverlayLabel : isPip ? t('callYou') : resolvedName;
  const mountRemoteAudio = shouldMountRemoteCallAudioSink(
    feed,
    isShare,
    currentUserId,
  );
  const mountRemoteAudioInMainDocument = isDocumentPipOpen && mountRemoteAudio;

  const ref = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stream = feed.stream ?? null;
  const mirrorLocalPreview =
    Boolean(currentUserId && feed.userId === currentUserId) &&
    shouldMirrorCallFeedVideoForDisplay({
      isShare,
      isLocalFeed: feed.isLocal(),
      videoTrack: liveVideoTrack,
    });
  const warmingVideoTrack = hasWarmingCallFeedVideoTrack(
    feed,
    feedVideoOptions,
  );

  const [, rerenderOnFeed] = useReducer((n: number) => n + 1, 0);
  const [streamBindVersion, rebindStream] = useReducer((n: number) => n + 1, 0);
  const [videoSurfaceReady, setVideoSurfaceReady] = useState(false);

  useEffect(() => {
    setVideoSurfaceReady(false);
  }, [liveVideoTrack?.id, streamBindVersion]);

  useEffect(() => {
    const el = ref.current;
    if (!el || !liveVideoTrack) return;

    const videoStream = createCallFeedVideoStream(liveVideoTrack);
    el.srcObject = videoStream;
    el.disablePictureInPicture = true;

    const markReady = () => {
      if (isCallFeedVideoSurfaceReady(el)) {
        setVideoSurfaceReady(true);
      }
    };

    const playVideo = () => {
      void el
        .play()
        .then(markReady)
        .catch((err) => {
          if (process.env.NODE_ENV === 'development') {
            console.debug('[CallFeedTile] video play rejected', err);
          }
          window.setTimeout(() => rebindStream(), 300);
        });
    };

    el.addEventListener('loadedmetadata', markReady);
    el.addEventListener('resize', markReady);
    el.addEventListener('loadeddata', markReady);

    let frameCallbackId: number | undefined;
    if ('requestVideoFrameCallback' in el) {
      frameCallbackId = el.requestVideoFrameCallback(() => {
        markReady();
      });
    }

    playVideo();
    const retryTimer = window.setInterval(() => {
      if (isCallFeedVideoSurfaceReady(el)) {
        setVideoSurfaceReady(true);
        return;
      }
      playVideo();
    }, 750);
    const giveUpTimer = window.setTimeout(() => {
      if (!isCallFeedVideoSurfaceReady(el)) {
        rebindStream();
      }
    }, 4000);

    const resizeObserver =
      typeof ResizeObserver !== 'undefined'
        ? new ResizeObserver(() => {
            if (el.clientWidth > 0 && el.clientHeight > 0) {
              playVideo();
              markReady();
            }
          })
        : null;
    resizeObserver?.observe(el);

    return () => {
      el.removeEventListener('loadedmetadata', markReady);
      el.removeEventListener('resize', markReady);
      el.removeEventListener('loadeddata', markReady);
      if (frameCallbackId != null && 'cancelVideoFrameCallback' in el) {
        el.cancelVideoFrameCallback(frameCallbackId);
      }
      window.clearInterval(retryTimer);
      window.clearTimeout(giveUpTimer);
      resizeObserver?.disconnect();
      el.srcObject = null;
    };
  }, [liveVideoTrack?.id, streamBindVersion]);

  const showVideoElement = hasVideo && !warmingVideoTrack;
  /** Avatar until video paints — avoids black tiles while remote/local tracks warm up. */
  const showAudioScrim = !showVideoElement || !videoSurfaceReady;
  const showParticipantVideoLabel = showVideoElement && !isPip;

  useEffect(() => {
    const el = audioRef.current;
    if (!el || !stream || !mountRemoteAudio) return;
    el.srcObject = stream;
    el.play().catch((err) => {
      if (process.env.NODE_ENV === 'development') {
        console.debug('[CallFeedTile] audio play rejected', err);
      }
    });

    return () => {
      el.srcObject = null;
    };
  }, [
    mountRemoteAudio,
    mountRemoteAudioInMainDocument,
    stream,
    streamBindVersion,
  ]);

  useEffect(() => {
    return registerCallPlaybackElement(ref.current);
  }, [hasVideo, liveVideoTrack?.id, streamBindVersion]);

  useEffect(() => {
    return registerCallPlaybackElement(audioRef.current);
  }, [
    mountRemoteAudio,
    mountRemoteAudioInMainDocument,
    stream,
    streamBindVersion,
  ]);

  useEffect(() => {
    const onFeedVisualChange = () => {
      rerenderOnFeed();
    };
    const onFeedMediaChange = () => {
      rebindStream();
      rerenderOnFeed();
    };
    feed.on(CallFeedEvent.MuteStateChanged, onFeedMediaChange);
    const onFeedStreamChange = () => {
      rebindStream();
      rerenderOnFeed();
    };
    feed.on(CallFeedEvent.NewStream, onFeedStreamChange);
    feed.on(CallFeedEvent.Speaking, onFeedVisualChange);
    return () => {
      feed.off(CallFeedEvent.MuteStateChanged, onFeedMediaChange);
      feed.off(CallFeedEvent.NewStream, onFeedStreamChange);
      feed.off(CallFeedEvent.Speaking, onFeedVisualChange);
    };
  }, [feed]);

  useEffect(() => {
    if (!stream) return;
    const onTrackChange = () => {
      rebindStream();
      rerenderOnFeed();
    };
    stream.addEventListener('addtrack', onTrackChange);
    stream.addEventListener('removetrack', onTrackChange);
    for (const track of stream.getTracks()) {
      track.addEventListener('mute', onTrackChange);
      track.addEventListener('unmute', onTrackChange);
      track.addEventListener('ended', onTrackChange);
    }
    return () => {
      stream.removeEventListener('addtrack', onTrackChange);
      stream.removeEventListener('removetrack', onTrackChange);
      for (const track of stream.getTracks()) {
        track.removeEventListener('mute', onTrackChange);
        track.removeEventListener('unmute', onTrackChange);
        track.removeEventListener('ended', onTrackChange);
      }
    };
  }, [stream]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onVisibility = () => {
      if (document.visibilityState !== 'visible') return;
      rebindStream();
      rerenderOnFeed();
      const el = ref.current;
      if (el && liveVideoTrack) {
        el.srcObject = createCallFeedVideoStream(liveVideoTrack);
        void el.play().catch(() => undefined);
      }
      const audioEl = audioRef.current;
      if (audioEl && mountRemoteAudio && stream) {
        audioEl.srcObject = stream;
        void audioEl.play().catch(() => undefined);
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [liveVideoTrack?.id, mountRemoteAudio, stream]);

  /** Analyse mic/remote line whenever the tile has a live audio track (not just Matrix `isSpeaking`, which lags and hid real levels). */
  const hasLiveAudioTrack =
    stream?.getAudioTracks().some((track) => track.readyState === 'live') ??
    false;
  const canVoiceWave =
    showAudioScrim &&
    !isShare &&
    !audioMuted &&
    hasLiveAudioTrack &&
    (feed.isLocal() || !feed.isAudioMuted());

  const tileAvatarSizePx = compactTileLayout
    ? 48
    : isFullView && !isPip
    ? 128
    : audioScrimLayout.panelDockTile
    ? 64
    : 80;
  const tileAvatarUrl = useMemo(() => {
    if (isShare) return undefined;
    if (feed.isLocal() && currentUserId) {
      const mxc = matrixMemberAvatarSquareForCall(
        client,
        roomId,
        currentUserId,
        tileAvatarSizePx,
      );
      if (mxc) return mxc;
      return currentUserProfileAvatarUrl?.trim() || hyphaAvatarUrl || undefined;
    }
    return (
      matrixMemberAvatarSquareForCall(
        client,
        roomId,
        feed.userId,
        tileAvatarSizePx,
      ) ?? hyphaAvatarUrl
    );
  }, [
    client,
    currentUserId,
    currentUserProfileAvatarUrl,
    feed,
    hyphaAvatarUrl,
    isShare,
    roomId,
    tileAvatarSizePx,
  ]);

  const tileCornerClass =
    panelFlush && !isPip && !isFullView ? 'rounded-none' : 'rounded-md';
  const activeSpeakerRingClass =
    'ring-2 ring-inset ring-[color:color-mix(in_srgb,var(--space-accent,var(--color-accent-9))_70%,transparent)]';

  return (
    <div
      className={cn(
        /* Outer shell: no overflow clip — active-speaker ring renders above video. */
        'relative min-w-0 bg-black',
        isFullView && !isPip
          ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col'
          : compactTileLayout
          ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col'
          : 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
        isShare && isFullView && 'h-full min-h-0 w-full',
      )}
    >
      <div
        className={cn(
          'relative min-h-0 min-w-0 flex-1 overflow-hidden bg-black',
          tileCornerClass,
        )}
      >
        <CallRaiseHandBadge
          handRaised={handRaised}
          order={raiseHandOrder}
          ariaLabel={
            raiseHandOrder != null
              ? t('callRaiseHandBadgeOrder', { order: raiseHandOrder })
              : t('callRaiseHandBadge')
          }
          title={
            raiseHandOrder != null
              ? t('callRaiseHandBadgeOrder', { order: raiseHandOrder })
              : t('callRaiseHandBadge')
          }
        />
        <CallFloatingReactionOverlay reactions={floatingReactions} />
        {showVideoElement ? (
          <video
            ref={ref}
            data-hypha-call-feed-video=""
            className={cn(
              resolveCallFeedVideoSurfaceClassName({
                mirrorLocalPreview,
                showVideoSurface: videoSurfaceReady,
                isFullView,
                isPip,
                isShare,
                panelFlush,
                panelVideoFit,
              }),
              !videoSurfaceReady && 'opacity-0',
            )}
            autoPlay
            playsInline
            disablePictureInPicture
            disableRemotePlayback
            controlsList="nodownload noremoteplayback"
            muted
            aria-label={ariaLabel}
          />
        ) : null}
        {showAudioScrim ? (
          <div className={audioScrimLayout.scrimClass} aria-label={ariaLabel}>
            <div className={audioScrimLayout.contentClass}>
              <div className={audioScrimLayout.avatarClass}>
                {tileAvatarUrl ? (
                  <img
                    src={tileAvatarUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="eager"
                    decoding="async"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <User
                    className={audioScrimLayout.avatarIconClass}
                    aria-hidden
                  />
                )}
              </div>
              <p className={audioScrimLayout.nameClass}>
                {showSkeleton ? (
                  <Skeleton
                    loading
                    width={100}
                    height={16}
                    className="mx-auto rounded"
                  />
                ) : (
                  overlayLabel
                )}
              </p>
              {audioMuted ? (
                <p className={audioScrimLayout.mutedClass}>
                  <MicOff
                    className={isPip ? 'h-3 w-3' : 'h-3.5 w-3.5'}
                    strokeWidth={2.25}
                    aria-hidden
                  />
                  {t('callParticipantMuted')}
                </p>
              ) : null}
              <CallAudioVoiceWaves
                mediaStream={stream}
                active={canVoiceWave}
                onDarkScrim
                size={audioScrimLayout.waveSize}
                className={audioScrimLayout.waveClass}
              />
            </div>
          </div>
        ) : null}
        {isActiveSpeaker ? (
          <div
            className={cn(
              'pointer-events-none absolute inset-0 z-[8]',
              tileCornerClass,
              activeSpeakerRingClass,
            )}
            aria-hidden
          />
        ) : null}
      </div>
      {showParticipantVideoLabel ? (
        <div className={videoLabelLayout.barClass}>
          <span
            className={cn(
              'min-w-0 max-w-[min(12rem,42vw)] truncate',
              CALL_FEED_VIDEO_LABEL_NAME_CLASS,
            )}
          >
            {showSkeleton ? (
              <Skeleton loading width={88} height={14} />
            ) : (
              overlayLabel
            )}
          </span>
          {audioMuted ? (
            <span
              className="inline-flex shrink-0 items-center gap-0.5 text-rose-400"
              title={t('callParticipantMuted')}
            >
              <MicOff className="h-3 w-3" strokeWidth={1.75} aria-hidden />
              <span
                className={cn(
                  'font-medium leading-[inherit]',
                  videoLabelLayout.muteTextSrOnly && 'sr-only',
                )}
              >
                {t('callParticipantMuted')}
              </span>
            </span>
          ) : null}
        </div>
      ) : null}
      {mountRemoteAudio
        ? (() => {
            const audioSink = (
              <audio
                ref={audioRef}
                autoPlay
                playsInline
                aria-hidden
                className={
                  mountRemoteAudioInMainDocument
                    ? 'pointer-events-none fixed size-0 overflow-hidden opacity-0'
                    : undefined
                }
              />
            );
            if (
              mountRemoteAudioInMainDocument &&
              typeof document !== 'undefined'
            ) {
              return createPortal(
                audioSink,
                resolveCallAudioPortalTarget(document),
              );
            }
            return audioSink;
          })()
        : null}
    </div>
  );
};
