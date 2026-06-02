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
import type { MatrixClient, GroupCall, Room } from 'matrix-js-sdk';
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
import { Skeleton } from '@hypha-platform/ui';
import {
  matrixMemberDisplayLabel,
  needsHyphaProfileResolutionForMatrixLabel,
} from './matrix-room-member-display';
import { CallAudioVoiceWaves } from './call-audio-voice-waves';
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
import {
  resolveCallStageLayout,
  resolveSpeakerPrimaryStripIndices,
  type CallGalleryTilePlacement,
  type CallViewportTier,
} from './call-stage-layout-engine';
import {
  resolveCallStageShareLayout,
  shareFeedLayoutKey,
} from './call-stage-share-layout';
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
} from './call-feed-tile-video';
import { registerCallPlaybackElement } from './call-playback-registry';
import { callAccentAlertOnDarkText } from './call-accent-alert-styles';

export type HumanChatPanelCallStageLayout = 'panel' | 'fullView' | 'hidden';

type HumanChatPanelCallStageBaseProps = {
  client: MatrixClient | null;
  roomId: string | null;
  groupCall: GroupCall | null;
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
  fullViewSplitContainerRef?: RefObject<HTMLDivElement | null>;
  /** Document PiP open — remote audio sinks mount on the main page (WCUX-PIP-1). */
  isDocumentPipOpen?: boolean;
  /** Dock viewport tier (WCUX-LAYOUT-0); inferred from layout when omitted. */
  viewportTier?: CallViewportTier;
};

function feedKeyForActive(feed: CallFeed): string {
  return `${feed.userId}::${feed.deviceId ?? ''}`;
}

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
}: CallSpeakerPrimaryStripProps) {
  const { speakerIndex, stripIndices, overflowCount } =
    resolveSpeakerPrimaryStripIndices(
      tiles.length,
      activeSpeakerIndex,
      stripMaxVisible,
    );
  const speakerTile = tiles[speakerIndex];
  const stripTiles = stripIndices
    .map((index) => ({ index, item: tiles[index] }))
    .filter((entry): entry is { index: number; item: RemoteTileItem } =>
      Boolean(entry.item),
    );

  return (
    <div
      className={cn(
        'flex min-h-0 min-w-0 flex-1 gap-1.5 overflow-hidden',
        isPortrait ? 'flex-col' : 'flex-row',
        className,
      )}
    >
      <div
        className={cn('flex min-h-0 min-w-0 flex-col', cellClassName)}
        style={{ flex: `${speakerPrimaryRatio} 1 0%` }}
      >
        {speakerTile ? (
          panelDock ? (
            <CallDockAspectTileShell className="h-full">
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
            ? 'flex flex-col overflow-y-auto'
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
                ? 'min-w-0 shrink-0'
                : 'relative min-h-0 w-full min-w-0 flex-1 overflow-hidden',
            )}
          >
            {panelDock ? (
              <CallDockAspectTileShell sizing="width">
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
  groupCall: GroupCall | null,
  callKind: 'audio' | 'video' | null,
  isLocalVideoMuted: boolean,
  isScreensharing: boolean,
  callState: SpaceGroupCallState,
  currentUserId: string | null = null,
  inCallUserIds: string[] | null = null,
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
  const showLocalPip = hasRemotesOrShare;
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
  groupCall: GroupCall | null,
  callKind: 'audio' | 'video' | null,
  isLocalVideoMuted: boolean,
  isScreensharing: boolean,
  callState: SpaceGroupCallState,
  currentUserId?: string | null,
  inCallUserIds?: string[] | null,
): boolean {
  const m = getHumanChatPanelCallStageModel(
    groupCall,
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
    props.groupCall,
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
  groupCall: _groupCall,
  callKind: _callKind,
  isLocalVideoMuted: _isLocalVideoMuted,
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
  fullViewSplitContainerRef,
  isDocumentPipOpen = false,
  viewportTier: viewportTierProp,
}: HumanChatPanelCallStageMainProps) {
  const t = useTranslations('HumanChatPanel');
  const labelId = useId();
  const [galleryPage, setGalleryPage] = useState(0);
  const localSplitRef = useRef<HTMLDivElement | null>(null);
  const splitRef = fullViewSplitContainerRef ?? localSplitRef;
  const onSplit = onFullViewPaneSplitChange;
  const handleExpand = useCallback(() => {
    onRequestFullView?.();
  }, [onRequestFullView]);

  const remoteUserTiles = useMemo(
    () =>
      buildRemoteUserTiles(model.remoteUserMedia, model.missingRemoteUserIds),
    [model.missingRemoteUserIds, model.remoteUserMedia],
  );
  const mainGalleryTiles = useMemo(() => {
    const tiles: RemoteTileItem[] = [...remoteUserTiles];
    if (model.localUserMedia[0]) {
      tiles.push({ kind: 'feed', feed: model.localUserMedia[0] });
    }
    return tiles;
  }, [model.localUserMedia, remoteUserTiles]);
  const galleryParticipantCount =
    remoteUserTiles.length + (model.localUserMedia.length > 0 ? 1 : 0);
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
  const resolvedViewportTier: CallViewportTier =
    viewportTierProp ?? (isFull ? 'V-L' : isDocumentPipOpen ? 'V-PiP' : 'V-M');
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
  const activeShareLayoutKey = shareFeedLayoutKey(rawShareFeeds);
  const shareLayoutResetKey = [
    activeShareLayoutKey,
    localShareActive ? 'local' : '',
    presenterShareOnly ? 'presenter' : '',
    hasPendingRemoteShare ? 'pending' : '',
  ].join('|');

  const activeSpeakerIndex = useMemo(() => {
    if (!activeSpeakerKey) return 0;
    const idx = mainGalleryTiles.findIndex(
      (item) =>
        item.kind === 'feed' &&
        feedKeyForActive(item.feed) === activeSpeakerKey,
    );
    return idx >= 0 ? idx : 0;
  }, [activeSpeakerKey, mainGalleryTiles]);

  const layoutPlan = useMemo(
    () =>
      resolveCallStageLayout({
        viewportTier: resolvedViewportTier,
        participantDeviceCount: mainGalleryTiles.length,
        hasActiveShare: hasRenderableShare || isScreensharing,
        activeSpeakerIndex,
        galleryPage,
      }),
    [
      resolvedViewportTier,
      mainGalleryTiles.length,
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
  const hasRemotesOrShare =
    remoteUserMedia.length > 0 ||
    missingRemoteUserIds.length > 0 ||
    hasRenderableShare;
  const showLocalInMainGrid =
    rawShowLocalInMainGrid || (!hasRemotesOrShare && localUserMedia.length > 0);
  const showLocalPip = rawShowLocalPip && hasRemotesOrShare;
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

  const room: Room | null =
    roomId && client ? client.getRoom(roomId) ?? null : null;

  const showExpand = layout === 'panel' && !fullViewOpen && onRequestFullView;

  const shareParticipantTiles = useMemo(() => {
    /** Presenter dock: all in-call tiles (feeds + placeholders + local). */
    if (presenterShareOnly) {
      return mainGalleryTiles;
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
    mainGalleryTiles,
    presenterShareOnly,
    remoteUserTiles,
    showLocalPip,
    localUserMedia,
  ]);

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

  const useMainGalleryLayout =
    !useShareWithParticipantsLayout &&
    (layoutPlan.renderer === 'thresholdGallery' ||
      layoutPlan.renderer === 'paginatedGallery');

  const useSpeakerGalleryLayout =
    !useShareWithParticipantsLayout && layoutPlan.renderer === 'speakerGallery';

  const useSpeakerPrimaryStripLayout =
    !useShareWithParticipantsLayout &&
    !isScreensharing &&
    layoutPlan.renderer === 'speakerPrimaryStrip';

  const useShareParticipantGallery =
    useShareWithParticipantsLayout && shareParticipantTiles.length >= 4;

  /** One camera tile only, no share: flex column fill (no empty grid track / FV-1). */
  const useFullViewSingleMainTile =
    !useShareWithParticipantsLayout && layoutPlan.renderer === 'soloTile';

  /** Skip corner PiP when gallery grid already includes the local tile. */
  const showFloatingLocalPip =
    isVideoCall &&
    localUserMedia.length > 0 &&
    hasLocalWebcam &&
    showLocalPip &&
    !useShareWithParticipantsLayout &&
    !useMainGalleryLayout &&
    !useSpeakerGalleryLayout &&
    !useSpeakerPrimaryStripLayout;

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

  const renderUserTile = (feed: CallFeed, keyIdx: number) => (
    <CallFeedTile
      key={feedKey(feed, keyIdx)}
      client={client}
      roomId={roomId}
      currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
      feed={feed}
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
      isDocumentPipOpen={isDocumentPipOpen}
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
          isDocumentPipOpen={isDocumentPipOpen}
          t={t}
        />
      </div>
    ));
  };

  const renderParticipantShareSidebar = (
    keyPrefix: number,
    tileClassName: string,
    presenterOnly = false,
  ) => {
    if (useShareParticipantGallery) {
      return (
        <CallParticipantGalleryGrid
          tiles={shareParticipantTiles}
          isFull={isFull}
          galleryPage={galleryPage}
          onGalleryPageChange={setGalleryPage}
          showPagination={isFull}
          keyPrefix={keyPrefix}
          cellClassName={tileClassName}
          className={
            presenterOnly
              ? 'h-full w-full flex-1'
              : isFull
              ? 'min-h-[4.5rem] w-full flex-1'
              : 'ml-auto w-full min-w-0 shrink-0 border-l border-[color:color-mix(in_srgb,var(--space-accent,var(--color-accent-9))_45%,transparent)]'
          }
          renderTile={renderRemoteUserTile}
          pageLabel={(current, total) =>
            t('callGalleryPage', { current, total })
          }
          previousPageLabel={t('callGalleryPreviousPage')}
          nextPageLabel={t('callGalleryNextPage')}
        />
      );
    }

    return (
      <div
        className={cn(
          'flex min-h-0 flex-col gap-1.5 overflow-y-auto p-1.5',
          presenterOnly
            ? 'h-full w-full flex-1'
            : isFull
            ? 'min-h-[4.5rem] w-full flex-1 lg:max-w-none'
            : 'ml-auto w-[min(44%,13rem)] min-w-[8.5rem] shrink-0 border-l border-[color:color-mix(in_srgb,var(--space-accent,var(--color-accent-9))_45%,transparent)]',
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
    : panelFlush && userGridTileCount <= 1
    ? 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col'
    : userGridTileCount > 1 && !isFull
    ? 'relative flex h-full min-h-0 w-full min-w-0'
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
              ) : isFull && shareParticipantTiles.length >= 2 ? (
                <CallSpeakerPrimaryStrip
                  tiles={shareParticipantTiles}
                  activeSpeakerIndex={shareActiveSpeakerIndex}
                  speakerPrimaryRatio={0.7}
                  stripMaxVisible={5}
                  cellClassName="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col"
                  renderTile={renderRemoteUserTile}
                  overflowLabel={(count) => `+${count}`}
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
              ) : !isFull ? (
                <CallPresenterParticipantFilmstrip
                  tiles={shareParticipantTiles}
                  renderTile={renderRemoteUserTile}
                  pageLabel={(current, total) =>
                    t('callGalleryPage', { current, total })
                  }
                  previousPageLabel={t('callGalleryPreviousPage')}
                  nextPageLabel={t('callGalleryNextPage')}
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
                        style={{ flex: `${a} 1 0%` }}
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
                      {onSplit && (
                        <CallFullViewPaneSplitter
                          orientation={isFull ? 'vertical' : 'vertical'}
                          containerRef={splitRef}
                          ratio={r}
                          onRatioChange={(v) => onSplit('sideBySide', v)}
                          className={isFull ? 'hidden lg:block' : undefined}
                          aria-label={t('callPaneResizeSharePeople')}
                        />
                      )}
                      <div
                        className={cn(
                          'flex min-h-0 flex-col gap-1.5 overflow-y-auto p-1.5',
                          isFull
                            ? 'w-full min-h-[4.5rem] max-h-[min(50dvh,20rem)] flex-1 lg:max-w-none'
                            : 'min-w-[7.5rem] shrink-0',
                        )}
                        style={{ flex: `${1 - a} 1 0%` }}
                        role="group"
                        aria-label={t('callLayoutSideBySide')}
                      >
                        {useShareParticipantGallery ? (
                          <CallParticipantGalleryGrid
                            tiles={shareParticipantTiles}
                            isFull={isFull}
                            galleryPage={galleryPage}
                            onGalleryPageChange={setGalleryPage}
                            showPagination={isFull}
                            keyPrefix={1000}
                            cellClassName={cn(
                              'w-full shrink-0 min-h-0',
                              isFull
                                ? 'min-h-[4.5rem]'
                                : 'aspect-video min-h-[4rem]',
                            )}
                            renderTile={renderRemoteUserTile}
                            pageLabel={(current, total) =>
                              t('callGalleryPage', { current, total })
                            }
                            previousPageLabel={t('callGalleryPreviousPage')}
                            nextPageLabel={t('callGalleryNextPage')}
                          />
                        ) : (
                          shareParticipantTiles.map((item, i) => (
                            <div
                              key={
                                item.kind === 'feed'
                                  ? feedKey(item.feed, 1000 + i)
                                  : `ph-side-${item.userId}-${i}`
                              }
                              className={cn(
                                'w-full shrink-0',
                                isFull
                                  ? 'min-h-[4.5rem]'
                                  : 'aspect-video min-h-[4rem]',
                              )}
                            >
                              {renderRemoteUserTile(item, 1000 + i)}
                            </div>
                          ))
                        )}
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
                          useShareParticipantGallery
                            ? 'flex min-h-[8rem] flex-1 flex-col'
                            : 'flex min-h-[3.5rem] items-stretch gap-2 overflow-x-auto',
                        )}
                        style={{ flex: `${1 - a} 1 0%` }}
                        role="group"
                        aria-label={t('callLayoutFilmstrip')}
                      >
                        {useShareParticipantGallery ? (
                          <CallParticipantGalleryGrid
                            tiles={shareParticipantTiles}
                            isFull={isFull}
                            galleryPage={galleryPage}
                            onGalleryPageChange={setGalleryPage}
                            showPagination
                            keyPrefix={2000}
                            cellClassName="min-h-0 w-full min-w-0"
                            renderTile={renderRemoteUserTile}
                            pageLabel={(current, total) =>
                              t('callGalleryPage', { current, total })
                            }
                            previousPageLabel={t('callGalleryPreviousPage')}
                            nextPageLabel={t('callGalleryNextPage')}
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
                    useShareParticipantGallery ||
                    Boolean(speakerFeedForTopMode || speakerTopPlaceholderId);
                  return (
                    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
                      {hasSpeakerTopPane && (
                        <div
                          className={cn(
                            'w-full min-h-0 shrink-0 border-b border-border/30 p-2',
                            useShareParticipantGallery
                              ? 'flex min-h-[8rem] max-h-[min(45dvh,20rem)] flex-col'
                              : 'min-h-[3.5rem] max-h-[min(40dvh,16rem)]',
                          )}
                          style={{ flex: `${a} 1 0%` }}
                          role="group"
                          aria-label={t('callLayoutSpeakerOnTop')}
                        >
                          {useShareParticipantGallery ? (
                            <CallParticipantGalleryGrid
                              tiles={shareParticipantTiles}
                              isFull={isFull}
                              galleryPage={galleryPage}
                              onGalleryPageChange={setGalleryPage}
                              showPagination
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
                                  isDocumentPipOpen={isDocumentPipOpen}
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
              {isFull && fullViewLayoutMode === 'pip' && (
                <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
                  <div className="absolute inset-0 flex min-h-0 min-w-0">
                    {renderSharePane(300)}
                  </div>
                  <div
                    className={cn(
                      'pointer-events-none absolute end-4 bottom-4 z-10 flex flex-col',
                      useShareParticipantGallery
                        ? 'max-h-[min(50dvh,22rem)] w-[min(44%,18rem)] min-w-[8rem]'
                        : 'w-[min(38%,12rem)] min-w-[6rem] gap-2',
                    )}
                    role="group"
                    aria-label={t('callLayoutPip')}
                  >
                    {useShareParticipantGallery ? (
                      <CallParticipantGalleryGrid
                        tiles={shareParticipantTiles}
                        isFull={isFull}
                        maxCols={2}
                        galleryPage={galleryPage}
                        onGalleryPageChange={setGalleryPage}
                        showPagination
                        keyPrefix={3000}
                        cellClassName="pointer-events-auto min-h-0 w-full min-w-0"
                        className="pointer-events-auto min-h-0 flex-1 overflow-hidden rounded-md border border-border/40 bg-black/80 shadow-lg backdrop-blur-sm"
                        renderTile={renderRemoteUserTile}
                        pageLabel={(current, total) =>
                          t('callGalleryPage', { current, total })
                        }
                        previousPageLabel={t('callGalleryPreviousPage')}
                        nextPageLabel={t('callGalleryNextPage')}
                      />
                    ) : (
                      shareParticipantTiles.map((item, i) => (
                        <div
                          key={
                            item.kind === 'feed'
                              ? feedKey(item.feed, 3000 + i)
                              : `ph-pip-${item.userId}-${i}`
                          }
                          className="pointer-events-auto"
                        >
                          {renderRemoteUserTile(item, 3000 + i)}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
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
        (useSpeakerPrimaryStripLayout ? (
          <div
            className={cn(
              'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
              panelFlush && !isFull ? 'p-0' : 'px-2 pb-2 pt-0',
            )}
            data-feed-tick={_feedVersion}
          >
            <CallSpeakerPrimaryStrip
              tiles={mainGalleryTiles}
              activeSpeakerIndex={activeSpeakerIndex}
              speakerPrimaryRatio={layoutPlan.speakerPrimaryRatio}
              stripMaxVisible={layoutPlan.stripMaxVisible}
              cellClassName={userGridCellClass}
              panelDock={!isFull}
              renderTile={renderRemoteUserTile}
              overflowLabel={(count) => `+${count}`}
            />
          </div>
        ) : useSpeakerGalleryLayout ? (
          <div
            className={cn(
              'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
              panelFlush && !isFull ? 'p-0' : 'px-2 pb-2 pt-0',
            )}
            data-feed-tick={_feedVersion}
          >
            <CallSpeakerPrimaryStrip
              tiles={mainGalleryTiles}
              activeSpeakerIndex={activeSpeakerIndex}
              speakerPrimaryRatio={layoutPlan.speakerPrimaryRatio}
              stripMaxVisible={layoutPlan.stripMaxVisible}
              cellClassName={userGridCellClass}
              panelDock={!isFull}
              renderTile={renderRemoteUserTile}
              overflowLabel={(count) => `+${count}`}
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
              tiles={mainGalleryTiles}
              isFull={isFull}
              galleryLayout={layoutPlan.galleryLayout ?? undefined}
              tilePlacements={layoutPlan.tilePlacements}
              galleryPage={galleryPage}
              onGalleryPageChange={setGalleryPage}
              showPagination={
                layoutPlan.showGalleryPagination ||
                (isFull &&
                  mainGalleryTiles.length > CALL_GALLERY_MAX_TILES_PER_PAGE)
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
              panelFlush ? 'p-0' : 'px-2 pb-2 pt-0',
            )}
            data-feed-tick={_feedVersion}
          >
            {remoteUserMedia[0] ? (
              <div className="flex h-full min-h-0 w-full min-w-0 flex-1 flex-col">
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
                  isDocumentPipOpen={isDocumentPipOpen}
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
                  isDocumentPipOpen={isDocumentPipOpen}
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
                : cn(
                    hasRenderableShare ? 'max-h-[min(50vh,420px)]' : null,
                    !isFull && userGridTileCount > 1
                      ? 'auto-rows-[minmax(min(40vh,280px),1fr)]'
                      : null,
                    panelUserGridColumnClass,
                  ),
              !isFull &&
                !hasRenderableShare &&
                remoteUserMedia.length > 0 &&
                'min-h-[min(32vh,220px)]',
              !isFull && showLocalInMainGrid && 'min-h-[min(32vh,240px)]',
            )}
            data-feed-tick={_feedVersion}
          >
            {remoteUserTiles.map((item, i) => (
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
            {showLocalInMainGrid &&
              localUserMedia.map((feed, i) => (
                <div key={feedKey(feed, i)} className={userGridCellClass}>
                  <CallFeedTile
                    client={client}
                    roomId={roomId}
                    currentUserProfileAvatarUrl={currentUserProfileAvatarUrl}
                    feed={feed}
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
                    isDocumentPipOpen={isDocumentPipOpen}
                    t={t}
                  />
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
                isDocumentPipOpen={isDocumentPipOpen}
                t={t}
              />
            ))}
          </div>
        )}
    </section>
  );
}

function usePlaceholderParticipantName(
  room: Room | null,
  userId: string,
  resolveMemberLabel: (userId: string | undefined) => string,
  fallback: string,
): { text: string; showSkeleton: boolean } {
  const syncLabel = useMemo(() => {
    const roster = resolveMemberLabel(userId)?.trim();
    if (roster) return roster;
    const m = room?.getMember(userId) ?? null;
    if (m) return matrixMemberDisplayLabel(m, userId);
    return resolveMemberLabel(userId)?.trim() || fallback;
  }, [room, userId, resolveMemberLabel, fallback]);

  const needsProfile = needsHyphaResolutionForCallLabel(syncLabel, userId);
  const { privyUserId: linkedSub, isLoading: loadingLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: needsProfile ? userId : undefined,
    });
  const { person, isLoading: loadingPerson } = usePersonBySub({
    sub: linkedSub,
  });

  const text = useMemo(() => {
    const fromPerson = person ? formatHyphaPersonName(person) : '';
    if (fromPerson) return fromPerson;
    return syncLabel;
  }, [person, syncLabel]);

  const showSkeleton =
    needsProfile && (loadingLink || (Boolean(linkedSub) && loadingPerson));

  return { text, showSkeleton };
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
  t: (key: string) => string;
}) {
  const room: Room | null =
    roomId && client ? client.getRoom(roomId) ?? null : null;
  const { text: label, showSkeleton } = usePlaceholderParticipantName(
    room,
    userId,
    resolveMemberLabel,
    t('callRemoteParticipant'),
  );
  const px = isPip ? 48 : isFullView && !isPip ? 128 : 80;
  const avatarUrl =
    matrixMemberAvatarSquareForCall(client, roomId, userId, px) ??
    (userId === currentUserId
      ? currentUserProfileAvatarUrl?.trim() || undefined
      : undefined);

  const statusLine = remoteMediaStall
    ? t('callRemoteParticipantMediaStalled')
    : t('callConnecting');

  return (
    <div
      className={cn(
        'relative flex min-h-0 min-w-0 flex-1 flex-col items-center justify-center gap-3 overflow-hidden rounded-md bg-black p-4 text-center text-zinc-50',
        isPip && 'gap-1.5 p-2',
      )}
      role="status"
      aria-busy={!remoteMediaStall}
      aria-label={`${label} — ${statusLine}`}
    >
      <div
        className={cn(
          'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-zinc-200 ring-1 ring-white/20',
          isPip
            ? 'h-8 w-8'
            : isFullView && !isPip
            ? 'h-20 w-20 sm:h-24 sm:w-24'
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
      <p
        className={cn(
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
  room: Room | null,
  feed: CallFeed,
  currentUserId: string | null,
  resolveMemberLabel: (userId: string | undefined) => string,
  fallback: string,
  isPip: boolean,
  isShare: boolean,
): { text: string; showSkeleton: boolean } {
  const uid = feed.userId;
  const isLocalFeed = feed.isLocal();

  const syncLabel = useMemo(() => {
    if (isPip) return ''; // caller uses "You"
    if (isLocalFeed && currentUserId) {
      return resolveMemberLabel(currentUserId).trim();
    }
    /** Roster/Hypha merge first — avoid Privy slug from raw Matrix member displayname. */
    const roster = resolveMemberLabel(uid)?.trim();
    if (roster) return roster;
    const m = room?.getMember(uid) ?? null;
    if (m) return matrixMemberDisplayLabel(m, uid);
    return resolveMemberLabel(uid)?.trim() || fallback;
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
    !isPip &&
    !isShare &&
    !isLocalFeed &&
    needsHyphaResolutionForCallLabel(syncLabel, uid);

  const { privyUserId: linkedSub, isLoading: loadingLink } =
    useUserPrivyIdByMatrixId({
      matrixUserId: needsProfile ? uid : undefined,
    });
  const { person, isLoading: loadingPerson } = usePersonBySub({
    sub: linkedSub,
  });

  const text = useMemo(() => {
    if (isPip) return ''; // overlay uses callYou
    if (isLocalFeed && currentUserId) return syncLabel;
    const fromPerson = person ? formatHyphaPersonName(person) : '';
    if (fromPerson) return fromPerson;
    return syncLabel;
  }, [isPip, isLocalFeed, currentUserId, person, syncLabel]);

  const showSkeleton =
    needsProfile && (loadingLink || (Boolean(linkedSub) && loadingPerson));

  return { text, showSkeleton };
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
  isDocumentPipOpen = false,
  t,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  currentUserProfileAvatarUrl?: string | null;
  feed: CallFeed;
  isShare?: boolean;
  isPip?: boolean;
  isActiveSpeaker?: boolean;
  isFullView?: boolean;
  panelVideoFit?: 'cover' | 'contain';
  panelFlush?: boolean;
  room: Room | null;
  currentUserId: string | null;
  resolveMemberLabel: (userId: string | undefined) => string;
  isMicrophoneMuted?: boolean;
  isDocumentPipOpen?: boolean;
  t: (key: string) => string;
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
      isDocumentPipOpen={isDocumentPipOpen}
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
  isDocumentPipOpen = false,
  t,
}: {
  client: MatrixClient | null;
  roomId: string | null;
  room: Room | null;
  currentUserId: string | null;
  currentUserProfileAvatarUrl?: string | null;
  feed: CallFeed;
  isShare: boolean;
  isPip: boolean;
  isFullView: boolean;
  panelVideoFit: 'cover' | 'contain';
  panelFlush: boolean;
  isActiveSpeaker: boolean;
  resolveMemberLabel: (userId: string | undefined) => string;
  nameFallback: string;
  isMicrophoneMuted?: boolean;
  isDocumentPipOpen?: boolean;
  t: (key: string) => string;
}) => {
  const audioMuted = feedReportsAudioMutedForTile(
    feed,
    isMicrophoneMuted,
    isShare,
  );
  const { text: resolvedName, showSkeleton } = useCallParticipantDisplayName(
    room,
    feed,
    currentUserId,
    resolveMemberLabel,
    nameFallback,
    isPip,
    isShare,
  );
  const shareOverlayLabel =
    isShare && !isPip
      ? formatCallShareTileLabel(resolvedName, nameFallback)
      : resolvedName;
  const overlayLabel = isPip ? t('callYou') : shareOverlayLabel;
  const ariaLabel =
    isShare && !isPip ? shareOverlayLabel : isPip ? t('callYou') : resolvedName;
  const mountRemoteAudio = shouldMountRemoteCallAudioSink(feed, isShare);
  const mountRemoteAudioInMainDocument = isDocumentPipOpen && mountRemoteAudio;

  const ref = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const stream = feed.stream ?? null;
  const liveVideoTrack = resolveCallFeedLiveVideoTrack(feed);
  const mirrorLocalPreview =
    Boolean(currentUserId && feed.userId === currentUserId) &&
    shouldMirrorCallFeedVideoForDisplay({
      isShare,
      isLocalFeed: feed.isLocal(),
      videoTrack: liveVideoTrack,
    });
  const warmingVideoTrack = hasWarmingCallFeedVideoTrack(feed);
  const hasVideo = liveVideoTrack !== null;

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

  const showVideoSurface = hasVideo && videoSurfaceReady && !warmingVideoTrack;

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
      feed.removeListener(CallFeedEvent.MuteStateChanged, onFeedMediaChange);
      feed.removeListener(CallFeedEvent.NewStream, onFeedStreamChange);
      feed.removeListener(CallFeedEvent.Speaking, onFeedVisualChange);
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
  const canVoiceWave =
    !showVideoSurface &&
    !isShare &&
    !audioMuted &&
    (feed.isLocal() ||
      (!feed.isAudioMuted() && (stream?.getAudioTracks().length ?? 0) > 0));

  const tileAvatarSizePx = isPip ? 48 : isFullView && !isPip ? 128 : 80;
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
      return currentUserProfileAvatarUrl?.trim() || undefined;
    }
    return matrixMemberAvatarSquareForCall(
      client,
      roomId,
      feed.userId,
      tileAvatarSizePx,
    );
  }, [
    client,
    currentUserId,
    currentUserProfileAvatarUrl,
    feed,
    isShare,
    roomId,
    tileAvatarSizePx,
  ]);

  return (
    <div
      className={cn(
        /* `rounded-md` = button-like corners; solid black so letterboxing (if any) is never a light “white” gap in light mode */
        'relative min-w-0 overflow-hidden bg-black',
        panelFlush && !isPip && !isFullView ? 'rounded-none' : 'rounded-md',
        isFullView && !isPip
          ? 'flex h-full min-h-0 min-w-0 flex-1 flex-col'
          : isPip
          ? 'flex h-full min-h-0 w-full min-w-0'
          : 'flex h-full min-h-0 w-full min-w-0 flex-1 flex-col',
        isShare && !isFullView && 'min-h-[min(42vh,360px)] w-full',
        isShare && isFullView && 'h-full min-h-0 w-full',
        isActiveSpeaker &&
          'ring-2 ring-inset ring-[color:color-mix(in_srgb,var(--space-accent,var(--color-accent-9))_70%,transparent)]',
      )}
    >
      {hasVideo ? (
        <video
          ref={ref}
          className={cn(
            'absolute inset-0 z-[1] h-full w-full min-h-0',
            mirrorLocalPreview && '-scale-x-100',
            !showVideoSurface && 'opacity-0',
            isFullView && !isPip
              ? 'object-contain'
              : isShare
              ? 'object-contain'
              : panelFlush && !isPip && !isFullView
              ? 'object-cover'
              : !isPip && panelVideoFit === 'contain'
              ? 'object-contain'
              : 'object-cover',
          )}
          autoPlay
          playsInline
          muted
          aria-label={ariaLabel}
        />
      ) : null}
      {!showVideoSurface ? (
        <div
          className={cn(
            'relative z-[2] flex h-full w-full flex-col text-center',
            /* Fixed dark scrim: always pair with light glyphs (not theme `foreground`). */
            'bg-gradient-to-b from-zinc-900/95 to-black text-zinc-50',
            isPip
              ? 'items-center justify-center gap-1.5 p-2'
              : isFullView
              ? 'items-center justify-center gap-3 p-4'
              : 'items-start justify-start gap-2 p-2 pt-3',
          )}
          aria-label={ariaLabel}
        >
          <div
            className={cn(
              'relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-zinc-200 ring-1 ring-white/20',
              isPip
                ? 'h-8 w-8'
                : isFullView
                ? 'h-20 w-20 sm:h-24 sm:w-24'
                : 'h-14 w-14',
            )}
          >
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
                className={cn(
                  isPip
                    ? 'h-4 w-4'
                    : isFullView
                    ? 'h-10 w-10 sm:h-12 sm:w-12'
                    : 'h-7 w-7',
                )}
                aria-hidden
              />
            )}
          </div>
          <p
            className={cn(
              'line-clamp-2 max-w-full font-medium text-zinc-50',
              isFullView && !isPip ? 'text-base sm:text-lg' : 'text-sm',
              isPip && 'text-[10px] leading-tight',
            )}
          >
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
            <p
              className={cn(
                'inline-flex items-center gap-1 font-medium text-destructive',
                isPip ? 'text-[9px]' : 'text-xs',
              )}
            >
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
            size={isPip ? 'sm' : isFullView && !isPip ? 'lg' : 'md'}
            className={
              isPip ? 'max-w-[5.5rem]' : 'w-full max-w-[min(24rem,96%)]'
            }
          />
        </div>
      ) : null}
      {showVideoSurface && !isPip ? (
        <div
          className={cn(
            'absolute start-1 z-10 flex max-w-[calc(100%-0.5rem)] min-h-[1.75rem] rounded bg-background/80 px-1.5 py-0.5 text-xs',
            isFullView
              ? 'bottom-2 flex-col justify-end'
              : 'top-1 flex-row items-center gap-1.5',
          )}
        >
          <span className="min-w-0 truncate">
            {showSkeleton ? (
              <Skeleton loading width={88} height={14} />
            ) : (
              overlayLabel
            )}
          </span>
          {audioMuted ? (
            <span
              className={cn(
                'inline-flex shrink-0 items-center gap-0.5 text-destructive',
                isFullView && 'mt-0.5',
              )}
            >
              <MicOff className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
              <span
                className={cn(
                  'font-medium leading-none',
                  isFullView ? 'text-xs' : 'text-[10px]',
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
