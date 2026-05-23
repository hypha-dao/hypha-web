'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import {
  Maximize2,
  Minimize2,
  PictureInPicture2,
  PanelBottomOpen,
  ArrowUpRight,
} from 'lucide-react';
import {
  useMatrix,
  useMe,
  type SpaceGroupCallCaptureMode,
} from '@hypha-platform/core/client';
import { cn } from '@hypha-platform/ui-utils';
import { usePathname, useRouter } from 'next/navigation';
import {
  DEFAULT_CALL_FULL_VIEW_LAYOUT,
  HumanChatPanelCallBanner,
  HumanChatPanelCallStage,
  HumanChatPanelInCallControls,
  readCallFullViewLayoutFromStorage,
  persistCallFullViewLayout,
  type CallFullViewLayoutMode,
  type CallFullViewPaneSplit,
  readCallFullViewPaneSplit,
  persistCallFullViewPaneSplit,
} from './human-chat-panel';
import { matrixMemberDisplayLabelFromRoom } from './human-chat-panel/matrix-room-member-display';
import { useGlobalCallDock } from './global-call-dock-context';
import { getLocaleFromPath } from './get-locale-from-path';

type DockGeometry = {
  x: number;
  y: number;
  width: number;
  height: number;
};
type ResizeCorner = 'top-right' | 'bottom-left';

const DOCK_GEOMETRY_KEY = 'hypha-global-call-dock-geometry-v1';
const DOCK_MARGIN_PX = 16;
const SNAP_EDGE_PX = 24;
// Minimum dock size (thumbnail mode baseline); resize can never go below this.
const DOCK_MIN_WIDTH = 360;
const DOCK_MIN_HEIGHT = 260;
const THUMBNAIL_GEOMETRY: Pick<DockGeometry, 'width' | 'height'> = {
  width: DOCK_MIN_WIDTH,
  height: DOCK_MIN_HEIGHT,
};
const EXPANDED_GEOMETRY: Pick<DockGeometry, 'width' | 'height'> = {
  width: 640,
  height: 420,
};
const DEFAULT_PANE_SPLIT: Record<CallFullViewPaneSplit, number> = {
  sideBySide: 0.68,
  filmstrip: 0.72,
  speakerOnTop: 0.28,
};

function getDockOffsetBounds(width: number, height: number) {
  if (typeof window === 'undefined') {
    return { minX: -1000, maxX: 0, minY: -1000, maxY: 0 };
  }
  const maxX = 0;
  const maxY = 0;
  const minX = 2 * DOCK_MARGIN_PX - window.innerWidth + width;
  const minY = 2 * DOCK_MARGIN_PX - window.innerHeight + height;
  return { minX, maxX, minY, maxY };
}

function clampDockGeometry(next: DockGeometry): DockGeometry {
  const maxWidth =
    typeof window === 'undefined'
      ? DOCK_MIN_WIDTH
      : Math.max(280, window.innerWidth - 2 * DOCK_MARGIN_PX);
  const maxHeight =
    typeof window === 'undefined'
      ? DOCK_MIN_HEIGHT
      : Math.max(180, window.innerHeight - 2 * DOCK_MARGIN_PX);
  const minWidth = Math.min(DOCK_MIN_WIDTH, maxWidth);
  const minHeight = Math.min(DOCK_MIN_HEIGHT, maxHeight);
  const safeWidth = Number.isFinite(next.width) ? next.width : minWidth;
  const safeHeight = Number.isFinite(next.height) ? next.height : minHeight;
  const safeX = Number.isFinite(next.x) ? next.x : 0;
  const safeY = Number.isFinite(next.y) ? next.y : 0;
  const width = Math.min(Math.max(safeWidth, minWidth), maxWidth);
  const height = Math.min(Math.max(safeHeight, minHeight), maxHeight);
  const bounds = getDockOffsetBounds(width, height);
  return {
    width,
    height,
    x: Math.min(Math.max(safeX, bounds.minX), bounds.maxX),
    y: Math.min(Math.max(safeY, bounds.minY), bounds.maxY),
  };
}

function snapDockGeometry(next: DockGeometry): DockGeometry {
  const bounds = getDockOffsetBounds(next.width, next.height);
  let x = next.x;
  let y = next.y;
  if (Math.abs(x - bounds.maxX) <= SNAP_EDGE_PX) x = bounds.maxX;
  if (Math.abs(x - bounds.minX) <= SNAP_EDGE_PX) x = bounds.minX;
  if (Math.abs(y - bounds.maxY) <= SNAP_EDGE_PX) y = bounds.maxY;
  if (Math.abs(y - bounds.minY) <= SNAP_EDGE_PX) y = bounds.minY;
  return { ...next, x, y };
}

function readDockGeometry(): DockGeometry {
  if (typeof window === 'undefined') {
    return {
      x: 0,
      y: 0,
      width: THUMBNAIL_GEOMETRY.width,
      height: THUMBNAIL_GEOMETRY.height,
    };
  }
  try {
    const raw = window.localStorage.getItem(DOCK_GEOMETRY_KEY);
    if (!raw) {
      return {
        x: 0,
        y: 0,
        width: THUMBNAIL_GEOMETRY.width,
        height: THUMBNAIL_GEOMETRY.height,
      };
    }
    const parsed = JSON.parse(raw) as Partial<DockGeometry>;
    return {
      x: Number.isFinite(parsed.x) ? Number(parsed.x) : 0,
      y: Number.isFinite(parsed.y) ? Number(parsed.y) : 0,
      width: Number.isFinite(parsed.width)
        ? Number(parsed.width)
        : THUMBNAIL_GEOMETRY.width,
      height: Number.isFinite(parsed.height)
        ? Number(parsed.height)
        : THUMBNAIL_GEOMETRY.height,
    };
  } catch {
    return {
      x: 0,
      y: 0,
      width: THUMBNAIL_GEOMETRY.width,
      height: THUMBNAIL_GEOMETRY.height,
    };
  }
}

function persistDockGeometry(next: DockGeometry): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(DOCK_GEOMETRY_KEY, JSON.stringify(next));
  } catch {
    // ignore persistence failure
  }
}

export function GlobalCallDockOverlay() {
  const t = useTranslations('GlobalCallDock');
  const router = useRouter();
  const pathname = usePathname() ?? '';
  const { client } = useMatrix();
  const { person: me } = useMe();
  const {
    activeRoomId,
    activeSpaceSlug,
    showFloatingDock,
    dockMode,
    setDockMode,
    callState,
    callKind,
    errorCode,
    screenshareErrorCode,
    dismissScreenshareError,
    dismissCallError,
    retryFromError,
    isLocalVideoMuted,
    isScreensharing,
    tabBackgroundWhileInCall,
    othersInRoomCallCount,
    remoteMediaStall,
    dismissRemoteMediaStallBanner,
    feedVersion,
    activeSpeakerKey,
    inCallUserIdsForRoster,
    groupCall,
    roomGroupCallDeviceCount,
    isMicrophoneMuted,
    setMicrophoneMuted,
    setCameraMuted,
    setScreensharingEnabled,
    voiceProcessingPreset,
    setVoiceProcessingPreset,
    captureMode,
    capturePreference,
    capturePreferenceSelected,
    setCapturePreference,
    startCapture,
    pauseCapture,
    resumeCapture,
    stopCapture,
    recordingStatus,
    recordingError,
    remoteCaptureNotice,
    acknowledgeRemoteCaptureNotice,
    leave,
  } = useGlobalCallDock();

  const [layoutMode, setLayoutMode] = React.useState<CallFullViewLayoutMode>(
    DEFAULT_CALL_FULL_VIEW_LAYOUT,
  );
  const [paneSplit, setPaneSplit] = React.useState<{
    sideBySide: number;
    filmstrip: number;
    speakerOnTop: number;
  }>(DEFAULT_PANE_SPLIT);
  const [geometry, setGeometry] = React.useState<DockGeometry>(
    clampDockGeometry({
      x: 0,
      y: 0,
      width: THUMBNAIL_GEOMETRY.width,
      height: THUMBNAIL_GEOMETRY.height,
    }),
  );
  const [dockStorageHydrated, setDockStorageHydrated] = React.useState(false);
  const splitContainerRef = React.useRef<HTMLDivElement | null>(null);
  const dockRef = React.useRef<HTMLDivElement | null>(null);
  const lastNonFullscreenModeRef = React.useRef<'thumbnail' | 'expanded'>(
    dockMode === 'fullscreen' ? 'thumbnail' : dockMode,
  );
  const modeGeometryRef = React.useRef<{
    thumbnail: DockGeometry | null;
    expanded: DockGeometry | null;
  }>({
    thumbnail: null,
    expanded: null,
  });
  const persistTimeoutRef = React.useRef<number | null>(null);
  const latestGeometryRef = React.useRef<DockGeometry>(geometry);
  const dragRef = React.useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
  } | null>(null);
  const resizeRef = React.useRef<{
    pointerId: number;
    corner: ResizeCorner;
    startX: number;
    startY: number;
    startGeometry: DockGeometry;
  } | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isResizing, setIsResizing] = React.useState(false);
  const currentUserId = client?.getUserId?.() ?? null;
  const currentUserDisplayName = React.useMemo(() => {
    const profile = (me ?? null) as {
      name?: string | null;
      surname?: string | null;
      nickname?: string | null;
    } | null;
    const full = [profile?.name, profile?.surname]
      .filter(Boolean)
      .join(' ')
      .trim();
    if (full) return full;
    return profile?.nickname?.trim() || '';
  }, [me]);

  React.useEffect(() => {
    setLayoutMode(readCallFullViewLayoutFromStorage());
  }, []);

  React.useEffect(() => {
    setPaneSplit({
      sideBySide: readCallFullViewPaneSplit('sideBySide'),
      filmstrip: readCallFullViewPaneSplit('filmstrip'),
      speakerOnTop: readCallFullViewPaneSplit('speakerOnTop'),
    });
    setGeometry(clampDockGeometry(readDockGeometry()));
    setDockStorageHydrated(true);
  }, []);

  const onPaneSplitChange = React.useCallback(
    (which: CallFullViewPaneSplit, value: number) => {
      persistCallFullViewPaneSplit(which, value);
      setPaneSplit((prev) => ({ ...prev, [which]: value }));
    },
    [],
  );

  React.useEffect(() => {
    if (!dockStorageHydrated) return;
    const clamped = clampDockGeometry(geometry);
    latestGeometryRef.current = clamped;
    if (persistTimeoutRef.current != null) {
      window.clearTimeout(persistTimeoutRef.current);
    }
    persistTimeoutRef.current = window.setTimeout(() => {
      persistDockGeometry(clamped);
      persistTimeoutRef.current = null;
    }, 180);
    return () => {
      if (persistTimeoutRef.current != null) {
        window.clearTimeout(persistTimeoutRef.current);
        persistTimeoutRef.current = null;
      }
    };
  }, [dockStorageHydrated, geometry]);

  React.useEffect(() => {
    return () => {
      persistDockGeometry(clampDockGeometry(latestGeometryRef.current));
    };
  }, []);

  React.useEffect(() => {
    if (dockMode === 'fullscreen') return;
    const onResize = () => {
      setGeometry((prev) => clampDockGeometry(prev));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [dockMode]);

  React.useEffect(() => {
    if (dockMode === 'fullscreen') return;
    modeGeometryRef.current[dockMode] = clampDockGeometry(geometry);
  }, [dockMode, geometry]);

  React.useEffect(() => {
    if (!isDragging && !isResizing) return;

    const onMove = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && e.pointerId === drag.pointerId) {
        setGeometry((prev) =>
          clampDockGeometry({
            ...prev,
            x: drag.startOffsetX + (e.clientX - drag.startX),
            y: drag.startOffsetY + (e.clientY - drag.startY),
          }),
        );
      }

      const resize = resizeRef.current;
      if (!resize || e.pointerId !== resize.pointerId) return;
      const dx = e.clientX - resize.startX;
      const dy = e.clientY - resize.startY;
      const start = resize.startGeometry;

      if (resize.corner === 'top-right') {
        const nextWidth = start.width + dx;
        const nextHeight = start.height - dy;
        const widthDelta = nextWidth - start.width;
        setGeometry(
          clampDockGeometry({
            x: start.x + widthDelta,
            y: start.y,
            width: nextWidth,
            height: nextHeight,
          }),
        );
        return;
      }

      const nextWidth = start.width - dx;
      const nextHeight = start.height + dy;
      const heightDelta = nextHeight - start.height;
      setGeometry(
        clampDockGeometry({
          x: start.x,
          y: start.y + heightDelta,
          width: nextWidth,
          height: nextHeight,
        }),
      );
    };

    const onEnd = (e: PointerEvent) => {
      const drag = dragRef.current;
      if (drag && e.pointerId === drag.pointerId) {
        dragRef.current = null;
        setIsDragging(false);
      }
      const resize = resizeRef.current;
      if (resize && e.pointerId === resize.pointerId) {
        resizeRef.current = null;
        setIsResizing(false);
      }
      setGeometry((prev) => snapDockGeometry(clampDockGeometry(prev)));
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onEnd);
    window.addEventListener('pointercancel', onEnd);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onEnd);
      window.removeEventListener('pointercancel', onEnd);
    };
  }, [isDragging, isResizing]);

  const onDragStart = React.useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (dockMode === 'fullscreen') return;
      const target = e.target as HTMLElement;
      if (target.closest('button,[data-no-dock-drag]')) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        startOffsetX: geometry.x,
        startOffsetY: geometry.y,
      };
      setIsDragging(true);
    },
    [dockMode, geometry.x, geometry.y],
  );

  const onResizeStart = React.useCallback(
    (corner: ResizeCorner) => (e: React.PointerEvent<HTMLDivElement>) => {
      if (dockMode === 'fullscreen') return;
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        pointerId: e.pointerId,
        corner,
        startX: e.clientX,
        startY: e.clientY,
        startGeometry: geometry,
      };
      setIsResizing(true);
    },
    [dockMode, geometry],
  );

  const applyDockMode = React.useCallback(
    (nextMode: 'thumbnail' | 'expanded') => {
      const preset =
        nextMode === 'thumbnail' ? THUMBNAIL_GEOMETRY : EXPANDED_GEOMETRY;
      const saved = modeGeometryRef.current[nextMode];
      setGeometry((prev) =>
        clampDockGeometry(
          nextMode === 'thumbnail'
            ? {
                ...(saved ?? prev),
                width: preset.width,
                height: preset.height,
              }
            : saved
            ? saved
            : {
                ...prev,
                width: preset.width,
                height: preset.height,
              },
        ),
      );
      setDockMode(nextMode);
      lastNonFullscreenModeRef.current = nextMode;
    },
    [setDockMode],
  );

  const onToggleFullscreen = React.useCallback(() => {
    if (dockMode === 'fullscreen') {
      applyDockMode(lastNonFullscreenModeRef.current ?? 'thumbnail');
      return;
    }
    if (dockMode === 'thumbnail' || dockMode === 'expanded') {
      lastNonFullscreenModeRef.current = dockMode;
    }
    setDockMode('fullscreen');
  }, [applyDockMode, dockMode, setDockMode]);

  const resolveMemberLabel = React.useCallback(
    (userId: string | undefined) => {
      if (
        userId?.trim() &&
        currentUserId &&
        userId === currentUserId &&
        currentUserDisplayName
      ) {
        return currentUserDisplayName;
      }
      if (!userId?.trim()) return t('unknownMember');
      return matrixMemberDisplayLabelFromRoom(client, activeRoomId, userId);
    },
    [activeRoomId, client, currentUserDisplayName, currentUserId, t],
  );
  const locale = React.useMemo(() => getLocaleFromPath(pathname), [pathname]);
  const callSpaceHref = activeSpaceSlug
    ? `/${locale}/dho/${activeSpaceSlug}/coherence`
    : null;

  if (!showFloatingDock || !activeRoomId) return null;

  const modeIsFullscreen = dockMode === 'fullscreen';
  const containerStyle: React.CSSProperties = modeIsFullscreen
    ? {
        left: 16,
        right: 16,
        top: 72,
        bottom: 16,
      }
    : {
        width: geometry.width,
        height: geometry.height,
        right: 16,
        bottom: 16,
        transform: `translate(${geometry.x}px, ${geometry.y}px)`,
      };

  const onToggleMic = () => {
    void setMicrophoneMuted(!isMicrophoneMuted);
  };

  const onToggleCamera = () => {
    void setCameraMuted(!isLocalVideoMuted);
  };

  const onToggleScreenshare = () => {
    void setScreensharingEnabled(!isScreensharing);
  };
  const onVoiceProcessingPresetChange = (
    preset: 'standard' | 'voice_isolation' | 'music',
  ) => {
    void setVoiceProcessingPreset(preset);
  };
  const onCapturePreferenceChange = (
    mode: Exclude<SpaceGroupCallCaptureMode, 'none'>,
  ) => {
    setCapturePreference(mode);
  };
  const onStartCaptureWithMode = (
    mode?: Exclude<SpaceGroupCallCaptureMode, 'none'>,
  ) => {
    startCapture(mode);
  };
  const onPauseCapture = () => {
    pauseCapture();
  };
  const onResumeCapture = () => {
    resumeCapture();
  };
  const onStopCapture = () => {
    stopCapture();
  };
  const showDockBanner =
    errorCode != null ||
    screenshareErrorCode != null ||
    remoteMediaStall ||
    remoteCaptureNotice != null;

  return (
    <div
      ref={dockRef}
      data-testid="global-call-dock"
      className={cn(
        'fixed z-[130] flex min-h-[260px] min-w-[360px] flex-col overflow-hidden rounded-xl border border-border/60 bg-background/95 shadow-2xl backdrop-blur-sm',
        modeIsFullscreen ? 'rounded-2xl' : '',
      )}
      style={containerStyle}
    >
      {!modeIsFullscreen && (
        <>
          <div
            data-no-dock-drag
            onPointerDown={onResizeStart('top-right')}
            className="absolute -top-1 -right-1 z-[3] flex h-5 w-5 cursor-nesw-resize touch-none items-center justify-center"
            aria-label={t('resizeTopRightLabel')}
            title={t('resizeTopRightLabel')}
          >
            <div className="pointer-events-none relative h-3 w-3">
              <span className="absolute right-0 top-[1px] block h-[1.5px] w-2 rotate-45 rounded bg-foreground/70" />
              <span className="absolute right-[2px] top-[4px] block h-[1.5px] w-2 rotate-45 rounded bg-foreground/70" />
            </div>
          </div>
          <div
            data-no-dock-drag
            onPointerDown={onResizeStart('bottom-left')}
            className="absolute -bottom-1 -left-1 z-[3] flex h-5 w-5 cursor-nesw-resize touch-none items-center justify-center"
            aria-label={t('resizeBottomLeftLabel')}
            title={t('resizeBottomLeftLabel')}
          >
            <div className="pointer-events-none relative h-3 w-3">
              <span className="absolute left-0 top-[6px] block h-[1.5px] w-2 -rotate-[135deg] rounded bg-foreground/70" />
              <span className="absolute left-[2px] top-[3px] block h-[1.5px] w-2 -rotate-[135deg] rounded bg-foreground/70" />
            </div>
          </div>
        </>
      )}
      <div
        className={cn(
          'flex shrink-0 items-center gap-2 border-b border-border/50 bg-muted/45 px-2.5 py-2',
          modeIsFullscreen
            ? 'cursor-default'
            : 'cursor-grab active:cursor-grabbing',
        )}
        onPointerDown={onDragStart}
      >
        <p className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">
          {t('callTitle', { count: roomGroupCallDeviceCount })}
        </p>
        {callSpaceHref && (
          <button
            type="button"
            data-no-dock-drag
            onClick={() => router.push(callSpaceHref)}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-border/60 bg-background px-2 text-xs hover:bg-muted"
            aria-label={t('openSpaceLabel')}
            title={t('openSpaceLabel')}
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            {t('spaceButton')}
          </button>
        )}
        <div className="flex items-center gap-1">
          {dockMode !== 'thumbnail' && (
            <button
              type="button"
              data-no-dock-drag
              onClick={() => applyDockMode('thumbnail')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
              aria-label={t('minimizeLabel')}
              title={t('minimizeLabel')}
            >
              <PictureInPicture2 className="h-3.5 w-3.5" />
            </button>
          )}
          {!modeIsFullscreen && dockMode !== 'expanded' && (
            <button
              type="button"
              data-no-dock-drag
              onClick={() => applyDockMode('expanded')}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
              aria-label={t('expandLabel')}
              title={t('expandLabel')}
            >
              <PanelBottomOpen className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            type="button"
            data-no-dock-drag
            onClick={onToggleFullscreen}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border/60 bg-background hover:bg-muted"
            aria-label={
              modeIsFullscreen ? t('exitFullscreenLabel') : t('fullscreenLabel')
            }
            title={
              modeIsFullscreen ? t('exitFullscreenLabel') : t('fullscreenLabel')
            }
          >
            {modeIsFullscreen ? (
              <Minimize2 className="h-3.5 w-3.5" />
            ) : (
              <Maximize2 className="h-3.5 w-3.5" />
            )}
          </button>
        </div>
      </div>

      <div ref={splitContainerRef} className="min-h-0 min-w-0 flex-1">
        <HumanChatPanelCallStage
          client={client}
          roomId={activeRoomId}
          groupCall={groupCall}
          callKind={callKind}
          isLocalVideoMuted={isLocalVideoMuted}
          isScreensharing={isScreensharing}
          callState={callState}
          feedVersion={feedVersion}
          activeSpeakerKey={activeSpeakerKey}
          currentUserId={currentUserId}
          inCallUserIds={inCallUserIdsForRoster}
          remoteMediaStall={remoteMediaStall}
          currentUserProfileAvatarUrl={me?.avatarUrl ?? null}
          resolveMemberLabel={resolveMemberLabel}
          layout={modeIsFullscreen ? 'fullView' : 'panel'}
          panelVideoFit="cover"
          panelFlush={!modeIsFullscreen}
          fullViewOpen={modeIsFullscreen}
          fullViewLayoutMode={layoutMode}
          fullViewPaneSplit={paneSplit}
          onFullViewPaneSplitChange={onPaneSplitChange}
          fullViewSplitContainerRef={splitContainerRef}
        />
      </div>

      <div className="shrink-0 border-t border-border/50 bg-muted/35 px-2 py-2">
        {showDockBanner ? (
          <HumanChatPanelCallBanner
            callState={callState}
            callKind={callKind}
            errorCode={errorCode}
            isScreensharing={isScreensharing}
            screenshareErrorCode={screenshareErrorCode}
            tabBackgroundWhileInCall={tabBackgroundWhileInCall}
            isMicrophoneMuted={isMicrophoneMuted}
            isLocalVideoMuted={isLocalVideoMuted}
            participantCount={roomGroupCallDeviceCount}
            othersInRoomCallCount={othersInRoomCallCount}
            remoteMediaStall={remoteMediaStall}
            onDismissRemoteMediaStall={dismissRemoteMediaStallBanner}
            onLeave={() => {
              void leave();
            }}
            onToggleMic={onToggleMic}
            onToggleCamera={onToggleCamera}
            onToggleScreenshare={onToggleScreenshare}
            voiceProcessingPreset={voiceProcessingPreset}
            onVoiceProcessingPresetChange={onVoiceProcessingPresetChange}
            captureMode={captureMode}
            capturePreference={capturePreference}
            capturePreferenceSelected={capturePreferenceSelected}
            onCapturePreferenceChange={onCapturePreferenceChange}
            onStartCapture={onStartCaptureWithMode}
            onPauseCapture={onPauseCapture}
            onResumeCapture={onResumeCapture}
            onStopCapture={onStopCapture}
            recordingStatus={recordingStatus}
            recordingError={recordingError}
            remoteCaptureNotice={remoteCaptureNotice}
            onAcknowledgeRemoteCaptureNotice={acknowledgeRemoteCaptureNotice}
            onDismissScreenshareError={dismissScreenshareError}
            onRetryCall={retryFromError}
            onDismissCallError={dismissCallError}
          />
        ) : (
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
            onStartCapture={onStartCaptureWithMode}
            onPauseCapture={onPauseCapture}
            onResumeCapture={onResumeCapture}
            onStopCapture={onStopCapture}
            recordingStatus={recordingStatus}
            recordingError={recordingError}
            onLeave={() => {
              void leave();
            }}
            variant={modeIsFullscreen ? 'fullView' : 'inBanner'}
            inBannerLayout={modeIsFullscreen ? 'inline' : 'centered'}
          />
        )}
      </div>

      {modeIsFullscreen && (
        <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-black/5" />
      )}
    </div>
  );
}
